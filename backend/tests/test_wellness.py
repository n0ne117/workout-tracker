"""Wellness sync and the Health page's data."""
from datetime import date, timedelta

import pytest

from app.models import AppSettings, WellnessDay, WorkoutMetrics
from app.routers import intervals as intervals_router
from app.services import wellness_service

from conftest import add_workout


@pytest.fixture
def intervals(monkeypatch):
    """Stand-in for Intervals.icu: serves `days`, records each request's range."""
    state = {"days": {}, "calls": []}

    def fetch(api_key, athlete_id, oldest, newest):
        state["calls"].append((oldest, newest))
        return [{"id": d, **v} for d, v in state["days"].items()
                if oldest.isoformat() <= d <= newest.isoformat()]

    monkeypatch.setattr(wellness_service, "fetch", fetch)
    return state


@pytest.fixture
def connected(db):
    db.add(AppSettings(id=1, intervals_api_key="test-key", intervals_athlete_id="0"))
    db.commit()


def test_sync_stores_measurements_and_drops_bookkeeping(client, db, intervals, connected):
    today = date.today().isoformat()
    intervals["days"][today] = {"restingHR": 48, "hrv": 62.5, "sleepSecs": 27000,
                                "updated": "2026-10-22T06:00:00", "locked": False, "weight": None}

    assert client.post("/api/wellness/sync", json={}).json()["days"] == 1

    stored = db.get(WellnessDay, date.today()).data
    assert stored == {"restingHR": 48, "hrv": 62.5, "sleepSecs": 27000}


def test_sync_replaces_a_revised_day(client, db, intervals, connected):
    day = date.today().isoformat()
    intervals["days"][day] = {"sleepSecs": 20000}
    client.post("/api/wellness/sync", json={})
    intervals["days"][day] = {"sleepSecs": 27000, "sleepScore": 81}
    client.post("/api/wellness/sync", json={})
    db.expire_all()
    assert db.get(WellnessDay, date.today()).data == {"sleepSecs": 27000, "sleepScore": 81}


def test_full_sync_starts_at_the_first_workout_in_yearly_requests(client, intervals, connected):
    first = date.today() - timedelta(days=800)
    add_workout(client, started_at=f"{first.isoformat()}T08:00:00")
    body = client.post("/api/wellness/sync", json={"full": True}).json()
    assert body["oldest"] == first.isoformat()
    assert len(intervals["calls"]) == 3
    assert all((b - a).days < 365 for a, b in intervals["calls"])


def test_sync_needs_intervals_connected(client):
    assert client.post("/api/wellness/sync", json={}).status_code == 400


def test_days_carry_training_from_the_same_local_date(client, db):
    today = date.today()
    yesterday = today - timedelta(days=1)
    db.add_all([WellnessDay(date=yesterday, data={"hrv": 60}),
                WellnessDay(date=today, data={"hrv": 55, "restingHR": 50})])
    db.commit()
    w = add_workout(client, started_at=f"{yesterday.isoformat()}T23:30:00")
    db.add(WorkoutMetrics(workout_id=w["id"], icu_training_load=85))
    db.commit()
    # A workout before wellness tracking began is left out.
    add_workout(client, title="Old", started_at="2015-05-05T08:00:00")

    body = client.get("/api/wellness").json()

    assert body["fields"] == ["hrv", "restingHR", "trainingLoad", "trainingMinutes"]
    assert [d["date"] for d in body["days"]] == [yesterday.isoformat(), today.isoformat()]
    assert body["days"][0]["trainingLoad"] == 85
    assert body["days"][1]["trainingLoad"] == 0   # a rest day, not a missing one


def test_range_filter_and_empty_state(client, db):
    assert client.get("/api/wellness").json() == {"fields": [], "days": []}
    db.add_all([WellnessDay(date=date.today() - timedelta(days=100), data={"hrv": 1}),
                WellnessDay(date=date.today(), data={"hrv": 2})])
    db.commit()
    assert len(client.get("/api/wellness?days=30").json()["days"]) == 1
    status = client.get("/api/wellness/status").json()
    assert status["days"] == 2 and status["last"] == date.today().isoformat()


def test_import_backfills_wellness_history_on_first_run(db, intervals, monkeypatch):
    monkeypatch.setattr(intervals_router.intervals_service, "fetch_activities", lambda *a: [])
    old = (date.today() - timedelta(days=400)).isoformat()
    intervals["days"][old] = {"restingHR": 52}
    week_ago = (date.today() - timedelta(days=7)).isoformat()
    today = date.today().isoformat()

    intervals_router._execute_import("key", "0", week_ago, today)
    assert intervals_router._import_status["last_result"]["wellness_days"] == 1
    # The next run only refreshes its own window.
    intervals["calls"].clear()
    intervals_router._execute_import("key", "0", week_ago, today)
    assert intervals["calls"] == [(date.fromisoformat(week_ago), date.fromisoformat(today))]
