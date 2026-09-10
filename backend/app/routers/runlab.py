"""
RunLab — read-only analytics endpoints for running/trail_running.
All data comes from workout_metrics (pre-computed by intervals.icu).
No recomputation of CTL/ATL — we trust intervals.icu values.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import datetime, timedelta, date
import math
import statistics
import logging

from app.database import get_db
from app.models import Workout, WorkoutMetrics, AppSettings, RaceEntry

router = APIRouter(prefix="/api/runlab", tags=["runlab"])
logger = logging.getLogger(__name__)

RUNNING_SPORTS = ("running", "trail_running")

# Banister model constants
K_CTL = 42.0   # fitness time constant (days)
K_ATL =  7.0   # fatigue time constant (days)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_create_settings(db: Session) -> AppSettings:
    s = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if not s:
        s = AppSettings(id=1)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


def _acwr_status(ratio: Optional[float]) -> Optional[str]:
    if ratio is None:
        return None
    if ratio < 0.8:
        return "low"
    if ratio <= 1.3:
        return "green"
    if ratio <= 1.5:
        return "amber"
    return "red"


def _decay(value: float, days: int, k: float) -> float:
    """Exponential decay over `days` with time constant k."""
    return value * math.exp(-days / k)


def _parse_range(range_str: str):
    """Return (start_date, end_date) for a range string."""
    today = date.today()
    if range_str == "3m":
        start = today - timedelta(days=91)
    elif range_str == "1y":
        start = today - timedelta(days=365)
    elif range_str == "all":
        start = date(2000, 1, 1)
    else:  # 6m default
        start = today - timedelta(days=182)
    return start, today


# ── Settings ──────────────────────────────────────────────────────────────────

class RunLabSettingsUpdate:
    pass

from pydantic import BaseModel

class RunLabSettingsPatch(BaseModel):
    runlab_target_distances: Optional[list] = None
    runlab_hr_max:  Optional[int] = None
    runlab_hr_lthr: Optional[int] = None


@router.get("/settings")
def get_runlab_settings(db: Session = Depends(get_db)):
    s = _get_or_create_settings(db)
    return {
        "runlab_target_distances": s.runlab_target_distances or ["5k", "10k", "hm", "marathon", "wfl"],
        "runlab_hr_max":  s.runlab_hr_max,
        "runlab_hr_lthr": s.runlab_hr_lthr,
    }


@router.patch("/settings")
def patch_runlab_settings(payload: RunLabSettingsPatch, db: Session = Depends(get_db)):
    s = _get_or_create_settings(db)
    if payload.runlab_target_distances is not None:
        s.runlab_target_distances = payload.runlab_target_distances
    if payload.runlab_hr_max is not None:
        s.runlab_hr_max = payload.runlab_hr_max
    if payload.runlab_hr_lthr is not None:
        s.runlab_hr_lthr = payload.runlab_hr_lthr
    db.commit()
    return {
        "runlab_target_distances": s.runlab_target_distances or ["5k", "10k", "hm", "marathon", "wfl"],
        "runlab_hr_max":  s.runlab_hr_max,
        "runlab_hr_lthr": s.runlab_hr_lthr,
    }


# ── 6a: Summary ───────────────────────────────────────────────────────────────

@router.get("/summary")
def get_summary(db: Session = Depends(get_db)):
    today = datetime.utcnow().date()
    day7_ago  = today - timedelta(days=7)
    day28_ago = today - timedelta(days=28)
    day42_ago = today - timedelta(days=42)

    # Latest CTL/ATL from most recent running workout with metrics
    latest = (
        db.query(WorkoutMetrics, Workout)
        .join(Workout, Workout.id == WorkoutMetrics.workout_id)
        .filter(Workout.sport.in_(RUNNING_SPORTS))
        .filter(WorkoutMetrics.icu_ctl != None)
        .order_by(Workout.started_at.desc())
        .first()
    )

    ctl = atl = tsb = None
    if latest:
        wm, _ = latest
        ctl = wm.icu_ctl
        atl = wm.icu_atl
        tsb = (ctl - atl) if (ctl is not None and atl is not None) else None

    # CTL 42 days ago
    old = (
        db.query(WorkoutMetrics, Workout)
        .join(Workout, Workout.id == WorkoutMetrics.workout_id)
        .filter(Workout.sport.in_(RUNNING_SPORTS))
        .filter(WorkoutMetrics.icu_ctl != None)
        .filter(Workout.started_at <= datetime.combine(day42_ago, datetime.min.time()))
        .order_by(Workout.started_at.desc())
        .first()
    )
    ctl_6w_delta = None
    if ctl is not None and old:
        ctl_6w_delta = round(ctl - old[0].icu_ctl, 1)

    # Weekly km (last 7 days)
    weekly_rows = (
        db.query(Workout.distance_meters)
        .filter(Workout.sport.in_(RUNNING_SPORTS))
        .filter(Workout.started_at >= datetime.combine(day7_ago, datetime.min.time()))
        .all()
    )
    weekly_km = sum((r.distance_meters or 0) for r in weekly_rows) / 1000.0

    # ACWR: acute (7d) / chronic (28d ewma)
    load_rows = (
        db.query(Workout.started_at, WorkoutMetrics.icu_training_load)
        .join(WorkoutMetrics, WorkoutMetrics.workout_id == Workout.id)
        .filter(Workout.sport.in_(RUNNING_SPORTS))
        .filter(WorkoutMetrics.icu_training_load != None)
        .filter(Workout.started_at >= datetime.combine(day28_ago, datetime.min.time()))
        .all()
    )

    acute = chronic = acwr = None
    if load_rows:
        acute = sum(r.icu_training_load for r in load_rows
                    if r.started_at.date() >= day7_ago)
        # EWMA decay ~0.05/day for chronic
        if load_rows:
            chronic_sum = chronic_weight = 0.0
            for r in load_rows:
                days_ago = (today - r.started_at.date()).days
                w = math.exp(-0.05 * days_ago)
                chronic_sum += r.icu_training_load * w
                chronic_weight += w
            chronic = chronic_sum / chronic_weight if chronic_weight > 0 else None

        acwr = round(acute / chronic, 2) if (chronic and chronic > 0) else None

    return {
        "ctl":          round(ctl, 1)         if ctl is not None else None,
        "atl":          round(atl, 1)         if atl is not None else None,
        "tsb":          round(tsb, 1)         if tsb is not None else None,
        "ctl_6w_delta": ctl_6w_delta,
        "weekly_km":    round(weekly_km, 1),
        "acwr":         acwr,
        "acwr_status":  _acwr_status(acwr),
    }


# ── 6b: PMC ───────────────────────────────────────────────────────────────────

@router.get("/pmc")
def get_pmc(range: str = "6m", db: Session = Depends(get_db)):
    start, end = _parse_range(range)

    # Load all running workout metrics in or near the range
    # We need a warm-up period before `start` to seed CTL/ATL accurately
    warm_start = start - timedelta(days=120)

    rows = (
        db.query(Workout.started_at, WorkoutMetrics.icu_ctl, WorkoutMetrics.icu_atl,
                 WorkoutMetrics.icu_training_load)
        .join(WorkoutMetrics, WorkoutMetrics.workout_id == Workout.id)
        .filter(Workout.sport.in_(RUNNING_SPORTS))
        .filter(Workout.started_at >= datetime.combine(warm_start, datetime.min.time()))
        .order_by(Workout.started_at)
        .all()
    )

    if not rows:
        return []

    # Build a day-indexed dict of known values
    # On workout days, use intervals.icu's CTL/ATL as anchor points
    by_day: dict[date, dict] = {}
    for r in rows:
        d = r.started_at.date()
        if d not in by_day or (r.icu_ctl is not None):
            by_day[d] = {
                "ctl": r.icu_ctl,
                "atl": r.icu_atl,
                "load": r.icu_training_load or 0,
            }

    if not by_day:
        return []

    # Forward-fill daily series from first workout day to `end`
    all_dates = sorted(by_day.keys())
    first_day = all_dates[0]

    ctl = by_day[first_day]["ctl"] or 0.0
    atl = by_day[first_day]["atl"] or 0.0

    result = []
    cur = first_day
    while cur <= end:
        if cur in by_day:
            # Use intervals.icu anchor if available
            anchor = by_day[cur]
            if anchor["ctl"] is not None:
                ctl = anchor["ctl"]
            else:
                # Decay + add load
                ctl = ctl * math.exp(-1 / K_CTL) + (anchor["load"] * (1 - math.exp(-1 / K_CTL)))
            if anchor["atl"] is not None:
                atl = anchor["atl"]
            else:
                atl = atl * math.exp(-1 / K_ATL) + (anchor["load"] * (1 - math.exp(-1 / K_ATL)))
        else:
            # Decay only — no training
            ctl = ctl * math.exp(-1 / K_CTL)
            atl = atl * math.exp(-1 / K_ATL)

        tsb = ctl - atl

        if cur >= start:
            result.append({
                "date": cur.isoformat(),
                "ctl":  round(ctl, 2),
                "atl":  round(atl, 2),
                "tsb":  round(tsb, 2),
            })
        cur += timedelta(days=1)

    return result


# ── 6c: Balance ───────────────────────────────────────────────────────────────

@router.get("/balance")
def get_balance(window: int = 28, db: Session = Depends(get_db)):
    cutoff = datetime.utcnow() - timedelta(days=window)

    rows = (
        db.query(WorkoutMetrics.icu_hr_zone_times, Workout.started_at,
                 Workout.distance_meters)
        .join(Workout, Workout.id == WorkoutMetrics.workout_id)
        .filter(Workout.sport.in_(RUNNING_SPORTS))
        .filter(Workout.started_at >= cutoff)
        .all()
    )

    # Aggregate HR zone times (5 zones)
    totals = [0.0] * 5
    for r in rows:
        if r.icu_hr_zone_times and isinstance(r.icu_hr_zone_times, list):
            for i, v in enumerate(r.icu_hr_zone_times[:5]):
                totals[i] += (v or 0)

    total_time = sum(totals)
    easy_ratio = (totals[0] + totals[1]) / total_time if total_time > 0 else 0.0

    zone_times = {f"z{i+1}": round(totals[i]) for i in range(5)}

    # Weekly volume — last 12 ISO weeks
    twelve_weeks_ago = datetime.utcnow() - timedelta(weeks=12)
    vol_rows = (
        db.query(Workout.started_at, Workout.distance_meters)
        .filter(Workout.sport.in_(RUNNING_SPORTS))
        .filter(Workout.started_at >= twelve_weeks_ago)
        .all()
    )

    # Group by ISO week Monday
    week_map: dict[str, float] = {}
    for r in vol_rows:
        d = r.started_at.date()
        # Monday of the ISO week
        mon = d - timedelta(days=d.weekday())
        key = mon.isoformat()
        week_map[key] = week_map.get(key, 0.0) + (r.distance_meters or 0) / 1000.0

    # Fill in all 12 weeks (even with 0)
    weekly_volume = []
    for i in range(12):
        mon = (datetime.utcnow() - timedelta(weeks=11 - i)).date()
        mon = mon - timedelta(days=mon.weekday())
        key = mon.isoformat()
        weekly_volume.append({"week_start": key, "km": round(week_map.get(key, 0.0), 1)})

    return {
        "zone_times": zone_times,
        "easy_ratio": round(easy_ratio, 3),
        "weekly_volume": weekly_volume,
    }


# ── 6d: Race Predictions ──────────────────────────────────────────────────────

DISTANCE_PRESETS = {
    "1k":       1.0,
    "5k":       5.0,
    "10k":      10.0,
    "15k":      15.0,
    "hm":       21.0975,
    "marathon": 42.195,
    "50k":      50.0,
    "100k":     100.0,
    "wfl":      None,   # Wings for Life — special handling, no fixed target distance
}


def _riegel(t1_s: float, d1_km: float, d2_km: float) -> float:
    """Riegel formula: T2 = T1 * (D2/D1)^1.06"""
    return t1_s * (d2_km / d1_km) ** 1.06


# ── Wings for Life simulation ──────────────────────────────────────────────────
# Catcher car schedule: (minutes_from_race_start, speed_km_h)
# Race starts 11:00 UTC; car starts at 11:30 UTC (30 min in).
_CATCHER_CAR = [
    (30,  14),
    (60,  15),
    (90,  16),
    (120, 17),
    (150, 18),
    (180, 22),
    (210, 26),
    (240, 30),
    (270, 34),
    # After 15:30 UTC the car continues at 34 km/h indefinitely.
]


def _wings_for_life_simulate(pace_s_per_km: float):
    """
    Simulate Wings for Life for a runner holding constant pace.

    The car starts 30 min after the runners, initially at 14 km/h, then
    accelerates every 30 min.  We find the moment the car catches the runner.

    Returns (distance_km: float, race_duration_s: int).
    """
    v_runner = 3600.0 / pace_s_per_km   # km/h
    car_pos  = 0.0                       # km; car position when it departs at t=30min

    n = len(_CATCHER_CAR)
    for i, (t_start_min, v_car) in enumerate(_CATCHER_CAR):
        t_start = t_start_min / 60.0
        # Last listed segment extends indefinitely at 34 km/h
        t_end = (_CATCHER_CAR[i + 1][0] / 60.0) if i < n - 1 else 999.0

        if v_car > v_runner:
            # Car is faster — solve for intersection:
            # car_pos + v_car*(t - t_start) = v_runner*t
            # t = (car_pos - v_car*t_start) / (v_runner - v_car)
            t_catch = (car_pos - v_car * t_start) / (v_runner - v_car)
            if t_start <= t_catch <= t_end:
                dist = v_runner * t_catch
                return round(dist, 2), int(t_catch * 3600)

        # Advance car to end of segment (skip if last, handled above)
        if i < n - 1:
            car_pos += v_car * (t_end - t_start)

    # Runner faster than 34 km/h — effectively uncatchable; cap at 5 h run
    return round(v_runner * 5.0, 2), 5 * 3600


@router.get("/predictions")
def get_predictions(db: Session = Depends(get_db)):
    """
    For each target distance, collect all qualifying runs from the past 6 months,
    compute a Riegel prediction from each, sort fastest-first, keep the best 50%,
    and return the median of those.  This is more robust than using a single run —
    one fast 5k on a good day won't single-handedly distort the marathon prediction.

    Qualifying threshold per target: reference run must cover at least 25% of the
    target distance (and always at least 1 km).

    Each result includes a `source_runs` list so the UI can show which workouts
    contributed to the prediction.
    """
    sett = _get_or_create_settings(db)
    targets = sett.runlab_target_distances or ["5k", "10k", "hm", "marathon", "wfl"]

    cutoff = datetime.utcnow() - timedelta(days=180)   # 6 months

    all_runs = (
        db.query(Workout)
        .filter(Workout.sport.in_(RUNNING_SPORTS))
        .filter(Workout.started_at >= cutoff)
        .filter(Workout.distance_meters >= 1000)
        .filter(Workout.moving_time_seconds != None)
        .filter(Workout.moving_time_seconds > 0)
        .all()
    )

    if not all_runs:
        return []

    results = []
    for target in targets:
        target_lower = target.lower().strip()

        # ── Wings for Life — special simulation ──────────────────────────────
        if target_lower == "wfl":
            # Need at least a 5 km run for a meaningful pace estimate
            qualifying = [w for w in all_runs if (w.distance_meters / 1000.0) >= 5.0]
            if not qualifying:
                results.append({
                    "distance":    "wfl",
                    "distance_km": None,
                    "wfl":         True,
                    "no_data":     True,
                    "min_ref_km":  5.0,
                })
                continue

            # Simulate WfL for every qualifying run; keep (workout, sim) pairs
            pairs = [
                (w, _wings_for_life_simulate(
                    w.moving_time_seconds / (w.distance_meters / 1000.0)
                ))
                for w in qualifying
            ]   # each sim = (distance_km, race_duration_s)

            # Sort by predicted distance, highest first (best performances)
            pairs.sort(key=lambda x: x[1][0], reverse=True)
            keep = max(1, len(pairs) // 2)

            pred_dist = round(float(statistics.median([sim[0] for _, sim in pairs[:keep]])), 1)
            pred_time = int(statistics.median([sim[1] for _, sim in pairs[:keep]]))

            source_runs = [
                {
                    "id":                w.id,
                    "title":             w.title,
                    "date":              w.started_at.date().isoformat(),
                    "distance_km":       round(w.distance_meters / 1000.0, 2),
                    "time_s":            w.moving_time_seconds,
                    "predicted_dist_km": sim[0],
                    "predicted_time_s":  sim[1],
                    "used":              i < keep,
                }
                for i, (w, sim) in enumerate(pairs)
            ]

            results.append({
                "distance":               "wfl",
                "distance_km":            pred_dist,
                "predicted_time_seconds": pred_time,
                "wfl":                    True,
                "based_on": {
                    "total_runs": len(qualifying),
                    "used_runs":  keep,
                    "min_ref_km": 5.0,
                },
                "source_runs": source_runs,
            })
            continue

        # ── Standard Riegel prediction ────────────────────────────────────────
        target_km = DISTANCE_PRESETS.get(target_lower)
        if target_km is None:
            try:
                # Accept "25", "25k", "25km" — strip trailing km/k before parsing
                target_km = float(target_lower.replace("km", "").rstrip("k").strip())
            except ValueError:
                continue

        # Minimum reference distance: 25% of target, capped at 10 km so that
        # a standard 10k run always qualifies even for marathon/ultra predictions.
        min_ref_km = min(max(1.0, target_km * 0.25), 10.0)
        qualifying = [
            w for w in all_runs
            if (w.distance_meters / 1000.0) >= min_ref_km
        ]

        if not qualifying:
            results.append({
                "distance":    target,
                "distance_km": target_km,
                "wfl":         False,
                "no_data":     True,
                "min_ref_km":  round(min_ref_km, 1),
            })
            continue

        # Keep (workout, predicted_time) pairs so we can attribute each prediction
        pairs = [
            (w, _riegel(w.moving_time_seconds, w.distance_meters / 1000.0, target_km))
            for w in qualifying
        ]

        # Sort fastest (lowest time) first, keep top 50% (at least 1 run).
        # This discards slow easy/recovery runs while retaining enough data
        # for a stable median instead of cherry-picking a single peak effort.
        pairs.sort(key=lambda x: x[1])
        keep = max(1, len(pairs) // 2)

        predicted = int(statistics.median([pred for _, pred in pairs[:keep]]))

        source_runs = [
            {
                "id":          w.id,
                "title":       w.title,
                "date":        w.started_at.date().isoformat(),
                "distance_km": round(w.distance_meters / 1000.0, 2),
                "time_s":      w.moving_time_seconds,
                "predicted_s": round(pred),
                "used":        i < keep,
            }
            for i, (w, pred) in enumerate(pairs)
        ]

        results.append({
            "distance":               target,
            "distance_km":            target_km,
            "predicted_time_seconds": predicted,
            "wfl":                    False,
            "based_on": {
                "total_runs":     len(qualifying),
                "used_runs":      keep,
                "min_ref_km":     round(min_ref_km, 1),
            },
            "source_runs": source_runs,
        })

    return results
