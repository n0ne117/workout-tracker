"""Deleting a workout takes its metrics with it, on every delete path."""
from app.database import init_db
from app.models import WorkoutMetrics

from conftest import add_workout


def _attach_metrics(db, workout_id, **values):
    db.add(WorkoutMetrics(workout_id=workout_id, **values))
    db.commit()


def test_single_delete_removes_metrics_so_a_reused_id_inherits_nothing(client, db):
    first = add_workout(client)
    _attach_metrics(db, first["id"], icu_training_load=50, icu_hr_zone_times=[1, 2, 3])

    assert client.delete(f"/api/workouts/{first['id']}").status_code == 200
    assert db.query(WorkoutMetrics).count() == 0

    # SQLite hands the freed id to the next insert.
    second = add_workout(client, title="New")
    assert second["id"] == first["id"]
    assert client.get(f"/api/workouts/{second['id']}").json()["icu_hr_zone_times"] is None


def test_bulk_delete_removes_metrics(client, db):
    w = add_workout(client)
    _attach_metrics(db, w["id"], icu_training_load=1)
    assert client.post("/api/workouts/bulk/delete", json={"ids": [w["id"]]}).status_code == 200
    assert db.query(WorkoutMetrics).count() == 0


def test_delete_all_removes_metrics(client, db):
    w = add_workout(client)
    _attach_metrics(db, w["id"], icu_training_load=1)
    assert client.delete("/api/workouts?confirm=true").status_code == 200
    assert db.query(WorkoutMetrics).count() == 0


def test_startup_drops_orphaned_and_stale_metrics_but_keeps_valid_ones(client, db, raw_db):
    valid = add_workout(client, title="Valid")
    _attach_metrics(db, valid["id"], icu_training_load=1)
    stale = add_workout(client, title="Stale", started_at="2026-07-05T08:00:00")
    # Older than its workout: left behind by whoever held the id before.
    raw_db.execute("INSERT INTO workout_metrics (workout_id, icu_training_load, updated_at)"
                   " VALUES (?, 9, '2000-01-01 00:00:00')", (stale["id"],))
    raw_db.execute("INSERT INTO workout_metrics (workout_id, icu_training_load, updated_at)"
                   " VALUES (99999, 9, '2030-01-01 00:00:00')")
    raw_db.commit()

    init_db()

    assert [m.workout_id for m in db.query(WorkoutMetrics).all()] == [valid["id"]]
