"""
Daily wellness for the Health page, joined with each day's training.

The page works out trends and relationships itself; this hands it one row
per day with every stored metric plus that day's training load and minutes.
"""
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AppSettings, Workout, WorkoutMetrics, WellnessDay
from app.services import wellness_service

router = APIRouter(prefix="/api/wellness", tags=["wellness"])


@router.get("")
def list_wellness(days: Optional[int] = None, db: Session = Depends(get_db)):
    """Every day in the last `days` (all history when omitted), oldest first."""
    since = date.today() - timedelta(days=days - 1) if days else None

    q = db.query(WellnessDay).order_by(WellnessDay.date)
    if since:
        q = q.filter(WellnessDay.date >= since)
    rows = {w.date.isoformat(): dict(w.data) for w in q.all()}
    if not rows:
        return {"fields": [], "days": []}

    # Training from before wellness tracking began has nothing to line up
    # against, so it starts where the wellness data does.
    since = date.fromisoformat(min(rows))

    # started_at is local time, so its date is the day the workout happened.
    day = func.date(Workout.started_at)
    training = (
        db.query(
            day.label("day"),
            func.sum(WorkoutMetrics.icu_training_load).label("load"),
            func.sum(func.coalesce(Workout.moving_time_seconds, Workout.duration_seconds)).label("secs"),
        )
        .outerjoin(WorkoutMetrics, WorkoutMetrics.workout_id == Workout.id)
        .filter(Workout.started_at >= since)
        .group_by(day)
    )
    # A day without workouts trained zero, not "unknown" — rest days are
    # exactly what the day-after comparisons need to see.
    for row in rows.values():
        row["trainingLoad"] = 0
        row["trainingMinutes"] = 0
    for t in training.all():
        row = rows.setdefault(t.day, {"trainingLoad": 0, "trainingMinutes": 0})
        if t.load is not None:
            row["trainingLoad"] = round(t.load, 1)
        if t.secs:
            row["trainingMinutes"] = round(t.secs / 60)

    fields = sorted({
        k for r in rows.values() for k, v in r.items()
        if isinstance(v, (int, float)) and not isinstance(v, bool)
    })
    return {
        "fields": fields,
        "days": [{"date": d, **rows[d]} for d in sorted(rows)],
    }


@router.get("/status")
def wellness_status(db: Session = Depends(get_db)):
    first, last, count = db.query(
        func.min(WellnessDay.date), func.max(WellnessDay.date), func.count(WellnessDay.date)
    ).one()
    settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
    return {
        "connected": bool(settings and settings.intervals_api_key),
        "days": count,
        "first": first.isoformat() if first else None,
        "last": last.isoformat() if last else None,
    }


class SyncRequest(BaseModel):
    full: bool = False   # whole history instead of the last `days_back` days
    days_back: int = 30


@router.post("/sync")
def sync_wellness(req: SyncRequest, db: Session = Depends(get_db)):
    settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if not settings or not settings.intervals_api_key:
        raise HTTPException(status_code=400, detail="Connect Intervals.icu in Settings first")
    newest = date.today()
    oldest = (wellness_service.history_start(db) if req.full
              else newest - timedelta(days=max(1, req.days_back)))
    try:
        stored = wellness_service.sync(
            db, settings.intervals_api_key, settings.intervals_athlete_id or "0", oldest, newest
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Intervals.icu: {e}")
    return {"ok": True, "days": stored, "oldest": oldest.isoformat(), "newest": newest.isoformat()}
