from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from typing import List
from app.database import get_db
from app.models import GearItem, WorkoutGear, Workout, GEAR_TYPES
from app.schemas import GearCreate, GearUpdate, GearResponse, WorkoutResponse

router = APIRouter(prefix="/api/gear", tags=["gear"])


def _gear_stats_batch(gear_ids: list, db: Session) -> dict:
    """Fetch workout stats for multiple gear items in one aggregation query.
    Returns {gear_id: row} with activity_count, total_distance_meters,
    total_duration_seconds, days_count fields.
    """
    if not gear_ids:
        return {}
    rows = (
        db.query(
            WorkoutGear.gear_id,
            func.count(Workout.id).label('activity_count'),
            func.coalesce(func.sum(Workout.distance_meters), 0).label('total_distance_meters'),
            func.coalesce(func.sum(Workout.duration_seconds), 0).label('total_duration_seconds'),
            func.count(distinct(func.date(Workout.started_at))).label('days_count'),
        )
        .join(Workout, Workout.id == WorkoutGear.workout_id)
        .filter(WorkoutGear.gear_id.in_(gear_ids))
        .group_by(WorkoutGear.gear_id)
        .all()
    )
    return {r.gear_id: r for r in rows}


def _gear_response_from_stats(item: GearItem, stats) -> GearResponse:
    data = {c.name: getattr(item, c.name) for c in item.__table__.columns}
    return GearResponse(
        **data,
        distance_km=round((stats.total_distance_meters if stats else 0) / 1000, 1),
        duration_hours=round((stats.total_duration_seconds if stats else 0) / 3600, 1),
        activity_count=stats.activity_count if stats else 0,
        days_count=stats.days_count if stats else 0,
    )


def _gear_response(item: GearItem, db: Session) -> GearResponse:
    """Build a GearResponse for a single gear item."""
    stats_map = _gear_stats_batch([item.id], db)
    return _gear_response_from_stats(item, stats_map.get(item.id))


@router.get("", response_model=List[GearResponse])
def list_gear(db: Session = Depends(get_db)):
    items = db.query(GearItem).order_by(GearItem.created_at).all()
    if not items:
        return []
    stats_map = _gear_stats_batch([item.id for item in items], db)
    return [_gear_response_from_stats(item, stats_map.get(item.id)) for item in items]


@router.get("/{gear_id}", response_model=GearResponse)
def get_gear(gear_id: int, db: Session = Depends(get_db)):
    item = db.query(GearItem).filter(GearItem.id == gear_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Gear item not found")
    return _gear_response(item, db)


@router.get("/{gear_id}/workouts", response_model=List[WorkoutResponse])
def get_gear_workouts(gear_id: int, db: Session = Depends(get_db)):
    if not db.query(GearItem).filter(GearItem.id == gear_id).first():
        raise HTTPException(status_code=404, detail="Gear item not found")
    workouts = (
        db.query(Workout)
        .join(WorkoutGear, WorkoutGear.workout_id == Workout.id)
        .filter(WorkoutGear.gear_id == gear_id)
        .order_by(Workout.started_at.desc())
        .all()
    )
    return [WorkoutResponse.from_orm_with_track_flag(w) for w in workouts]


@router.post("", response_model=GearResponse, status_code=201)
def create_gear(payload: GearCreate, db: Session = Depends(get_db)):
    if payload.type not in GEAR_TYPES:
        raise HTTPException(status_code=422, detail=f"type must be one of {GEAR_TYPES}")
    item = GearItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _gear_response(item, db)


@router.patch("/{gear_id}", response_model=GearResponse)
def update_gear(gear_id: int, payload: GearUpdate, db: Session = Depends(get_db)):
    item = db.query(GearItem).filter(GearItem.id == gear_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Gear item not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return _gear_response(item, db)


@router.delete("/{gear_id}")
def delete_gear(gear_id: int, db: Session = Depends(get_db)):
    item = db.query(GearItem).filter(GearItem.id == gear_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Gear item not found")
    db.query(WorkoutGear).filter(WorkoutGear.gear_id == gear_id).delete()
    db.delete(item)
    db.commit()
    return {"ok": True}
