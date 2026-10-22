"""Cross-site protection, the health check, and responses that skip GPS tracks."""
import os

from conftest import add_workout

BODY = {"title": "A", "sport": "running", "started_at": "2026-07-04T08:00:00"}


def test_writes_from_another_site_are_refused(client):
    assert client.post("/api/workouts", json=BODY).status_code == 200
    assert client.post("/api/workouts", json=BODY, headers={"Origin": "http://tracker.local:7733"}).status_code == 200
    assert client.post("/api/workouts", json=BODY, headers={"Origin": "https://evil.example"}).status_code == 403


def test_no_cors_header_for_other_sites(client):
    r = client.get("/api/workouts", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in r.headers


def test_health_reports_an_unwritable_data_dir(client, monkeypatch):
    assert client.get("/api/health").json() == {"status": "ok"}
    real_access = os.access
    monkeypatch.setattr(os, "access", lambda path, mode: False if mode == os.W_OK else real_access(path, mode))
    assert client.get("/api/health").status_code == 503


def test_gear_workout_list_reports_has_track(client):
    w = add_workout(client)
    shoe = client.post("/api/gear", json={"name": "Shoe", "type": "shoes"}).json()
    client.post(f"/api/workouts/{w['id']}/gear/{shoe['id']}")
    listed = client.get(f"/api/gear/{shoe['id']}/workouts").json()
    assert [(x["title"], x["has_track"]) for x in listed] == [("Run", False)]
    assert client.get("/api/runlab/predictions").status_code == 200
