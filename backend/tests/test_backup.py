"""Backups round-trip workouts, metrics and gear links."""
import io
import json
import zipfile

import pytest

from app.models import GearItem, Workout, WorkoutGear, WorkoutMetrics

from conftest import add_workout


def _restore(client, payload: bytes):
    r = client.post("/api/backup/restore", files={"file": ("backup.zip", payload, "application/zip")})
    assert r.status_code == 200, r.text
    return r.json()


def _zip(manifest, workouts):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("manifest.json", json.dumps(manifest))
        zf.writestr("workouts.json", json.dumps(workouts))
    return buf.getvalue()


@pytest.mark.parametrize("kind", ["workouts", "full"])
def test_restore_keeps_metrics_and_gear_links(client, db, kind):
    a = add_workout(client, title="A")
    add_workout(client, title="B", sport="cycling", started_at="2026-07-05T08:00:00")
    shoe = client.post("/api/gear", json={"name": "Shoe", "type": "shoes"}).json()
    client.post(f"/api/workouts/{a['id']}/gear/{shoe['id']}")
    db.add(WorkoutMetrics(workout_id=a["id"], icu_training_load=42, icu_hr_zone_times=[10, 20]))
    db.commit()
    client.get("/api/workouts/stats")   # warm the stats cache

    result = _restore(client, client.get(f"/api/backup/{kind}").content)

    assert result["stats"]["errors"] == []
    db.expire_all()
    by_title = {w.title: w for w in db.query(Workout).all()}
    metrics = db.query(WorkoutMetrics).one()
    assert metrics.workout_id == by_title["A"].id and metrics.icu_training_load == 42
    link = db.query(WorkoutGear).one()
    assert link.workout_id == by_title["A"].id
    assert db.get(GearItem, link.gear_id).name == "Shoe"
    assert client.get("/api/workouts/stats").json()["total"] == 2


def test_old_backup_without_gear_links_says_so(client):
    client.post("/api/gear", json={"name": "Shoe", "type": "shoes"})
    payload = _zip({"version": "1", "type": "workouts"},
                   [{"id": 1, "title": "Old", "sport": "running", "started_at": "2020-01-01T08:00:00"}])
    assert _restore(client, payload)["stats"]["errors"]


def test_old_backup_file_times_are_converted_and_new_ones_left_alone(client):
    rows = [
        {"id": 1, "title": "fit", "sport": "running", "source": "fit_file", "started_at": "2026-07-01T05:00:00"},
        {"id": 2, "title": "icu", "sport": "running", "source": "intervals_icu", "started_at": "2026-07-01T07:00:00"},
    ]
    _restore(client, _zip({"version": "1", "type": "workouts"}, rows))
    times = {w["title"]: w["started_at"] for w in client.get("/api/workouts").json()["items"]}
    assert times == {"fit": "2026-07-01T07:00:00", "icu": "2026-07-01T07:00:00"}

    # A backup written now says its file times are local; restoring it changes nothing.
    current = client.get("/api/backup/workouts").content
    assert json.loads(zipfile.ZipFile(io.BytesIO(current)).read("manifest.json"))["file_times"] == "local"
    _restore(client, current)
    assert {w["title"]: w["started_at"] for w in client.get("/api/workouts").json()["items"]} == times
