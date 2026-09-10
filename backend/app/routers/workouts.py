from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, load_only
from sqlalchemy import or_, and_
from app.cache import get_stats_cache, set_stats_cache, invalidate_stats_cache
from typing import Optional, List
from datetime import datetime
from app.database import get_db
from app.models import Workout, WorkoutGear, GearItem, WorkoutMetrics, SPORT_CATEGORIES
from app.schemas import WorkoutCreate, WorkoutUpdate, WorkoutResponse, WorkoutDetail, WorkoutListResponse, GearResponse, TrimRequest

router = APIRouter(prefix="/api/workouts", tags=["workouts"])


@router.get("", response_model=WorkoutListResponse)
def list_workouts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=5000),
    sport: Optional[str] = None,
    is_race: Optional[bool] = None,
    search: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Workout)

    if sport:
        sports = [s.strip() for s in sport.split(",")]
        query = query.filter(Workout.sport.in_(sports))
    if is_race is not None:
        query = query.filter(Workout.is_race == is_race)
    if search:
        query = query.filter(Workout.title.ilike(f"%{search}%"))
    if date_from:
        query = query.filter(Workout.started_at >= date_from)
    if date_to:
        query = query.filter(Workout.started_at <= date_to)

    total = query.count()
    workouts = query.order_by(Workout.started_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = [WorkoutResponse.from_orm_with_track_flag(w) for w in workouts]
    return WorkoutListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/categories")
def get_categories():
    return {"categories": SPORT_CATEGORIES}


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    from collections import defaultdict

    cached = get_stats_cache()
    if cached is not None:
        return cached

    workouts = (
        db.query(Workout)
        .options(load_only(
            Workout.sport,
            Workout.started_at,
            Workout.duration_seconds,
            Workout.distance_meters,
            Workout.elevation_gain_meters,
            Workout.is_race,
            Workout.title,
        ))
        .order_by(Workout.started_at)
        .all()
    )
    if not workouts:
        return {
            "total": 0, "total_distance_km": 0, "total_duration_hours": 0,
            "total_elevation_m": 0, "races": 0,
            "by_sport": {}, "by_month": [], "by_year": [], "prs": {},
        }

    total_distance = sum(w.distance_meters or 0 for w in workouts)
    total_duration = sum(w.duration_seconds or 0 for w in workouts)
    total_elevation = sum(w.elevation_gain_meters or 0 for w in workouts)

    by_sport: dict = defaultdict(lambda: {"count": 0, "distance_km": 0.0, "duration_hours": 0.0})
    by_month: dict = defaultdict(lambda: {"count": 0, "distance_km": 0.0, "duration_hours": 0.0, "elevation_m": 0.0})
    by_year: dict = defaultdict(lambda: {"count": 0, "distance_km": 0.0, "duration_hours": 0.0})
    prs: dict = defaultdict(dict)
    heatmap: dict = defaultdict(int)

    for w in workouts:
        s = w.sport or "other"
        dist_km = (w.distance_meters or 0) / 1000
        dur_h = (w.duration_seconds or 0) / 3600
        ele_m = w.elevation_gain_meters or 0

        by_sport[s]["count"] += 1
        by_sport[s]["distance_km"] += dist_km
        by_sport[s]["duration_hours"] += dur_h

        if w.started_at:
            ym = (w.started_at.year, w.started_at.month)
            yr = w.started_at.year
            by_month[ym]["count"] += 1
            by_month[ym]["distance_km"] += dist_km
            by_month[ym]["duration_hours"] += dur_h
            by_month[ym]["elevation_m"] += ele_m
            by_year[yr]["count"] += 1
            by_year[yr]["distance_km"] += dist_km
            by_year[yr]["duration_hours"] += dur_h
            heatmap[w.started_at.date().isoformat()] += 1

        if w.distance_meters and w.distance_meters > prs[s].get("longest_m", 0):
            prs[s]["longest_m"] = w.distance_meters
            prs[s]["longest_title"] = w.title
            prs[s]["longest_date"] = w.started_at.isoformat() if w.started_at else None

        if w.distance_meters and w.duration_seconds:
            pace = w.duration_seconds / (w.distance_meters / 1000)
            existing = prs[s].get("fastest_pace_s_per_km")
            if existing is None or pace < existing:
                prs[s]["fastest_pace_s_per_km"] = round(pace)
                prs[s]["fastest_title"] = w.title
                prs[s]["fastest_date"] = w.started_at.isoformat() if w.started_at else None

        if ele_m and ele_m > prs[s].get("highest_elevation_m", 0):
            prs[s]["highest_elevation_m"] = round(ele_m)
            prs[s]["highest_title"] = w.title
            prs[s]["highest_date"] = w.started_at.isoformat() if w.started_at else None

    MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

    months_out = sorted(
        [{"year": y, "month": m, "month_name": MONTH_NAMES[m-1],
          "count": v["count"],
          "distance_km": round(v["distance_km"], 1),
          "duration_hours": round(v["duration_hours"], 1),
          "elevation_m": round(v["elevation_m"])}
         for (y, m), v in by_month.items()],
        key=lambda x: (x["year"], x["month"])
    )

    years_out = sorted(
        [{"year": y,
          "count": v["count"],
          "distance_km": round(v["distance_km"], 1),
          "duration_hours": round(v["duration_hours"], 1)}
         for y, v in by_year.items()],
        key=lambda x: x["year"]
    )

    sport_out = {
        s: {"count": v["count"],
            "distance_km": round(v["distance_km"], 1),
            "duration_hours": round(v["duration_hours"], 1)}
        for s, v in by_sport.items()
    }

    result = {
        "total": len(workouts),
        "total_distance_km": round(total_distance / 1000, 1),
        "total_duration_hours": round(total_duration / 3600, 1),
        "total_elevation_m": round(total_elevation),
        "races": sum(1 for w in workouts if w.is_race),
        "by_sport": sport_out,
        "by_month": months_out,
        "by_year": years_out,
        "prs": dict(prs),
        "heatmap": dict(heatmap),
    }
    set_stats_cache(result)
    return result


@router.get("/{workout_id}", response_model=WorkoutDetail)
def get_workout(workout_id: int, db: Session = Depends(get_db)):
    workout = db.query(Workout).filter(Workout.id == workout_id).first()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    data = {c.name: getattr(workout, c.name) for c in workout.__table__.columns}
    data["has_track"] = bool(workout.track_points)
    metrics = db.query(WorkoutMetrics).filter(WorkoutMetrics.workout_id == workout_id).first()
    if metrics:
        data["icu_hr_zone_times"] = metrics.icu_hr_zone_times
        data["icu_zone_times"]    = metrics.icu_zone_times
    return WorkoutDetail(**data)


@router.post("", response_model=WorkoutResponse)
def create_workout(workout_in: WorkoutCreate, db: Session = Depends(get_db)):
    workout = Workout(**workout_in.model_dump(), source="manual")
    db.add(workout)
    db.commit()
    invalidate_stats_cache()
    db.refresh(workout)
    return WorkoutResponse.from_orm_with_track_flag(workout)


@router.patch("/{workout_id}", response_model=WorkoutResponse)
def update_workout(workout_id: int, update: WorkoutUpdate, db: Session = Depends(get_db)):
    workout = db.query(Workout).filter(Workout.id == workout_id).first()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(workout, field, value)
    db.commit()
    invalidate_stats_cache()
    db.refresh(workout)
    return WorkoutResponse.from_orm_with_track_flag(workout)


@router.delete("/{workout_id}")
def delete_workout(workout_id: int, db: Session = Depends(get_db)):
    workout = db.query(Workout).filter(Workout.id == workout_id).first()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    db.query(WorkoutGear).filter(WorkoutGear.workout_id == workout_id).delete()
    db.delete(workout)
    db.commit()
    invalidate_stats_cache()
    return {"ok": True}


@router.post("/{workout_id}/trim", response_model=WorkoutDetail)
def trim_workout(workout_id: int, req: TrimRequest, db: Session = Depends(get_db)):
    from app.services.track_stats import recalculate_track_stats
    workout = db.query(Workout).filter(Workout.id == workout_id).first()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    if not workout.track_points:
        raise HTTPException(status_code=400, detail="No GPS track to trim")

    pts = workout.track_points
    n = len(pts)
    start = max(0, min(req.start_index, n - 2))
    end = max(start + 1, min(req.end_index, n - 1))

    trimmed = pts[start:end + 1]
    stats = recalculate_track_stats(trimmed)

    workout.track_points = trimmed
    for field, value in stats.items():
        if value is not None:
            setattr(workout, field, value)

    db.commit()
    db.refresh(workout)
    invalidate_stats_cache()

    data = {c.name: getattr(workout, c.name) for c in workout.__table__.columns}
    data["has_track"] = bool(workout.track_points)
    return WorkoutDetail(**data)


@router.delete("")
def delete_all_workouts(db: Session = Depends(get_db)):
    count = db.query(Workout).count()
    db.query(WorkoutGear).delete()
    db.query(Workout).delete()
    db.commit()
    invalidate_stats_cache()
    return {"ok": True, "deleted": count}


# ── Workout ↔ Gear ────────────────────────────────────────────────────────────

@router.get("/{workout_id}/gear", response_model=List[GearResponse])
def get_workout_gear(workout_id: int, db: Session = Depends(get_db)):
    if not db.query(Workout).filter(Workout.id == workout_id).first():
        raise HTTPException(status_code=404, detail="Workout not found")
    from app.routers.gear import _gear_stats_batch, _gear_response_from_stats
    items = (
        db.query(GearItem)
        .join(WorkoutGear, WorkoutGear.gear_id == GearItem.id)
        .filter(WorkoutGear.workout_id == workout_id)
        .order_by(GearItem.name)
        .all()
    )
    if not items:
        return []
    stats_map = _gear_stats_batch([item.id for item in items], db)
    return [_gear_response_from_stats(item, stats_map.get(item.id)) for item in items]


@router.post("/{workout_id}/gear/{gear_id}", status_code=201)
def add_workout_gear(workout_id: int, gear_id: int, db: Session = Depends(get_db)):
    if not db.query(Workout).filter(Workout.id == workout_id).first():
        raise HTTPException(status_code=404, detail="Workout not found")
    if not db.query(GearItem).filter(GearItem.id == gear_id).first():
        raise HTTPException(status_code=404, detail="Gear item not found")
    exists = db.query(WorkoutGear).filter(
        WorkoutGear.workout_id == workout_id,
        WorkoutGear.gear_id == gear_id,
    ).first()
    if not exists:
        db.add(WorkoutGear(workout_id=workout_id, gear_id=gear_id))
        db.commit()
    return {"ok": True}


@router.delete("/{workout_id}/gear/{gear_id}")
def remove_workout_gear(workout_id: int, gear_id: int, db: Session = Depends(get_db)):
    deleted = db.query(WorkoutGear).filter(
        WorkoutGear.workout_id == workout_id,
        WorkoutGear.gear_id == gear_id,
    ).delete()
    db.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="Link not found")
    return {"ok": True}
