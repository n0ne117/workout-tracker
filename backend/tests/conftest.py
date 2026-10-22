"""
Shared setup: one throwaway database for the whole run, emptied before each
test, and a fixed timezone so time conversion has something to convert.

DATA_DIR and TZ must be set before anything imports app.database, which
opens its engine at import time.
"""
import os
import sqlite3
import sys
import tempfile
from pathlib import Path

os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="workout-tracker-tests-")
os.environ["TZ"] = "Europe/Vienna"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal, engine, init_db
from app.main import app

TABLES = ("workout_metrics", "workout_gear", "workouts", "gear_items",
          "race_calendar", "challenges")


@pytest.fixture(scope="session")
def client():
    # base_url gives requests a Host to compare an Origin header against.
    with TestClient(app, base_url="http://tracker.local") as c:
        yield c


@pytest.fixture(autouse=True)
def empty_db(client):
    with engine.begin() as conn:
        for table in TABLES:
            conn.exec_driver_sql(f"DELETE FROM {table}")
    from app.cache import invalidate_stats_cache
    invalidate_stats_cache()
    yield


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def raw_db():
    """Plain sqlite3, for writing rows the way older versions left them."""
    con = sqlite3.connect(os.path.join(os.environ["DATA_DIR"], "workouts.db"))
    yield con
    con.close()


def add_workout(client, title="Run", sport="running", started_at="2026-07-04T08:00:00"):
    r = client.post("/api/workouts", json={"title": title, "sport": sport, "started_at": started_at})
    assert r.status_code == 200, r.text
    return r.json()
