"""
Intervals.icu wellness: daily records of resting HR, HRV, sleep, weight,
steps and more — much of it relayed from Apple Health or a watch.

Records are revised after the fact (last night's sleep lands in the morning,
a weight entry is corrected), so every sync re-fetches its whole window and
replaces what is stored.
"""
from datetime import date, timedelta

import httpx
from sqlalchemy.orm import Session

from app.models import Workout, WellnessDay
from app.services.intervals_service import BASE, _auth

# Intervals' bookkeeping, not measurements.
SKIP_FIELDS = {"id", "updated", "sportInfo", "locked", "tempWeight", "tempRestingHR"}

# One request per year keeps each response small however long the history.
CHUNK_DAYS = 365


def fetch(api_key: str, athlete_id: str, oldest: date, newest: date) -> list:
    url = f"{BASE}/athlete/{athlete_id}/wellness"
    with httpx.Client(timeout=60) as client:
        r = client.get(url, auth=_auth(api_key),
                       params={"oldest": oldest.isoformat(), "newest": newest.isoformat()})
        r.raise_for_status()
        return r.json()


def _clean(record: dict) -> dict:
    return {k: v for k, v in record.items() if k not in SKIP_FIELDS and v is not None}


def history_start(db: Session) -> date:
    """Where a full sync begins: the first workout, or ten years back."""
    first = db.query(Workout.started_at).order_by(Workout.started_at).first()
    return first[0].date() if first else date.today() - timedelta(days=3650)


def sync(db: Session, api_key: str, athlete_id: str, oldest: date, newest: date) -> int:
    """Fetch and store every day in the range. Returns how many days held data."""
    stored = 0
    start = oldest
    while start <= newest:
        end = min(start + timedelta(days=CHUNK_DAYS - 1), newest)
        for record in fetch(api_key, athlete_id, start, end):
            try:
                day = date.fromisoformat(record["id"])
            except (KeyError, TypeError, ValueError):
                continue
            data = _clean(record)
            if not data:
                continue
            db.merge(WellnessDay(date=day, data=data))
            stored += 1
        db.commit()
        start = end + timedelta(days=1)
    return stored
