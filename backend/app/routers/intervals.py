from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from app.database import get_db
from app.models import Workout, AppSettings, WorkoutMetrics
from app.services import intervals_service
from app.cache import invalidate_stats_cache
import logging

router = APIRouter(prefix="/api/intervals", tags=["intervals"])
logger = logging.getLogger(__name__)

_import_status: dict = {"running": False, "last_result": None, "cancel": False, "total": 0, "done": 0}
_debug_log: list = []
_DEBUG_DETAIL_LIMIT = 10   # log full stream details for first N activities, summary for the rest


class IntervalsImportRequest(BaseModel):
    api_key: str = ""           # empty = reuse stored key
    athlete_id: str = "0"       # "0" = authenticated user
    days_back: int = 90


class IntervalsSettingsUpdate(BaseModel):
    intervals_api_key: Optional[str] = None
    intervals_athlete_id: Optional[str] = None


def _get_or_create_settings(db: Session) -> AppSettings:
    s = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if not s:
        s = AppSettings(id=1)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


@router.get("/status")
def get_status(db: Session = Depends(get_db)):
    s = _get_or_create_settings(db)
    return {
        "connected": bool(getattr(s, "intervals_api_key", None)),
        "athlete_id": getattr(s, "intervals_athlete_id", "0") or "0",
        "import_running": _import_status["running"],
        "last_result": _import_status["last_result"],
    }


@router.post("/import")
def import_from_intervals(
    req: IntervalsImportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if _import_status["running"]:
        raise HTTPException(status_code=409, detail="Import already running")

    # Resolve API key: use provided key, fall back to stored key
    s = _get_or_create_settings(db)
    api_key = req.api_key.strip() or getattr(s, "intervals_api_key", None) or ""
    if not api_key:
        raise HTTPException(status_code=400, detail="No intervals.icu API key configured")

    # Persist credentials (only update key if a new one was provided)
    if req.api_key.strip():
        s.intervals_api_key = req.api_key.strip()
    s.intervals_athlete_id = req.athlete_id
    db.commit()

    # Resolve athlete ID: "0" means use the authenticated user
    athlete_id = req.athlete_id or "0"

    end_date   = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=req.days_back)
    oldest = start_date.strftime("%Y-%m-%d")
    newest = end_date.strftime("%Y-%m-%d")

    def run_import():
        global _debug_log
        _debug_log = [
            f"Import started: {datetime.now(timezone.utc).isoformat()}",
            f"Athlete ID: {athlete_id}  |  Range: {oldest} → {newest}",
            "",
        ]
        _import_status["running"] = True
        _import_status["cancel"] = False
        _import_status["total"] = 0
        _import_status["done"] = 0
        imported = skipped = errors = 0
        try:
            activities = intervals_service.fetch_activities(
                api_key, athlete_id, oldest, newest
            )
            _import_status["total"] = len(activities)
            _debug_log.append(f"Fetched {len(activities)} activities from intervals.icu")

            # Resolve real athlete ID from the first activity — "0" is only valid
            # for the activities list endpoint, not for the streams endpoint.
            resolved_athlete_id = athlete_id
            if activities:
                real_id = str(activities[0].get("athlete_id", "")).strip()
                if real_id and real_id != "0":
                    resolved_athlete_id = real_id
                    _debug_log.append(f"Resolved athlete ID: {athlete_id!r} → {resolved_athlete_id!r}")
                else:
                    _debug_log.append(f"Could not resolve athlete ID from activities (got {real_id!r}), keeping {athlete_id!r}")
            _debug_log.append("")

            from app.database import SessionLocal
            idb = SessionLocal()
            detail_count = 0
            for act in activities:
                if _import_status["cancel"]:
                    logger.info("Intervals import cancelled by user")
                    break
                act_id = str(act.get("id", ""))
                if not act_id:
                    continue
                ext_id = f"icu_{act_id}"
                existing = idb.query(Workout).filter(
                    Workout.garmin_activity_id == ext_id
                ).first()
                if existing:
                    skipped += 1
                    _import_status["done"] += 1
                    continue

                # Collect debug info for the first N new activities
                dbg = [] if detail_count < _DEBUG_DETAIL_LIMIT else None
                if dbg is not None:
                    detail_count += 1
                    act_name = act.get("name") or act.get("type") or act_id
                    act_date = act.get("start_date_local", "")[:10]
                    _debug_log.append(f"[{_import_status['done']+1}] {act_date} '{act_name}' (id={act_id})")

                try:
                    streams = intervals_service.fetch_streams(api_key, act_id, dbg=dbg)
                    data = intervals_service.activity_to_workout_data(act, streams, api_key=api_key, dbg=dbg)
                    data["garmin_activity_id"] = ext_id
                    workout = Workout(**{k: v for k, v in data.items() if hasattr(Workout, k)})
                    idb.add(workout)
                    idb.commit()
                    imported += 1
                except Exception as e:
                    logger.error(f"Error importing intervals activity {act_id}: {e}")
                    if dbg is not None:
                        dbg.append(f"  → EXCEPTION: {e}")
                    idb.rollback()
                    errors += 1
                    continue

                # Persist metrics — best-effort: never rolls back a committed workout
                try:
                    metrics = data.get("metrics", {})
                    if any(v is not None for v in metrics.values()):
                        m = WorkoutMetrics(workout_id=workout.id, **metrics)
                        idb.merge(m)
                        idb.commit()
                    logger.debug(f"Metrics for {act_id}: {metrics}")
                except Exception as me:
                    logger.warning(f"Could not save metrics for {act_id}: {me}")
                    idb.rollback()

                if dbg:
                    _debug_log.extend(dbg)
                    _debug_log.append("")
                _import_status["done"] += 1
            idb.close()
            cancelled = _import_status["cancel"]
            _debug_log.append(f"--- Done: imported={imported} skipped={skipped} errors={errors}" +
                              (" CANCELLED" if cancelled else ""))
            _import_status["last_result"] = {
                "imported": imported,
                "skipped": skipped,
                "errors": errors,
                "error": "Cancelled by user" if cancelled else None,
            }
        except Exception as e:
            logger.error(f"Intervals import failed: {e}")
            _debug_log.append(f"--- FATAL: {e}")
            _import_status["last_result"] = {
                "imported": imported,
                "skipped": skipped,
                "errors": errors,
                "error": str(e),
            }
        finally:
            _import_status["running"] = False
            _import_status["cancel"] = False
            invalidate_stats_cache()

    background_tasks.add_task(run_import)
    return {
        "ok": True,
        "message": f"Importing last {req.days_back} days from intervals.icu in background",
    }


@router.get("/import/status")
def get_import_status():
    return _import_status


@router.get("/import/debug-log", response_class=None)
def get_debug_log():
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse("\n".join(_debug_log) if _debug_log else "No log yet.")


@router.post("/import/cancel")
def cancel_import():
    if not _import_status["running"]:
        raise HTTPException(status_code=409, detail="No import running")
    _import_status["cancel"] = True
    return {"ok": True, "message": "Cancel signal sent"}


_backfill_status: dict = {
    "running": False,
    "phase": None,          # "streams" | "metrics" | None
    "streams_total": 0, "streams_done": 0,
    "metrics_total": 0, "metrics_done": 0,
    "last_result": None,
}

METRICS_FIELDS = (
    "id,start_date_local,start_date,type,sport_type,name,athlete_id,"
    "icu_training_load,icu_atl,icu_ctl,trimp,icu_hr_zone_times,icu_zone_times,"
    "perceived_exertion,icu_intensity,icu_efficiency_factor,icu_decoupling"
)


@router.post("/backfill")
def backfill(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Combined one-time backfill:
      Phase 1 – Streams: re-fetches GPS/power/HR/VO/GCT/stride data for every
        intervals.icu workout whose track_points were imported before the full
        stream set was requested (sentinel: no 'power' key in track_points[0]).
      Phase 2 – Metrics: fetches training-load, HR-zone times, and intensity
        data for every intervals.icu workout that has no WorkoutMetrics row yet.
    """
    if _backfill_status["running"]:
        raise HTTPException(status_code=409, detail="Backfill already running")

    s = _get_or_create_settings(db)
    api_key = getattr(s, "intervals_api_key", None) or ""
    if not api_key:
        raise HTTPException(status_code=400, detail="No intervals.icu API key configured")
    athlete_id = getattr(s, "intervals_athlete_id", "0") or "0"

    def run():
        from app.database import SessionLocal
        from app.models import Workout, WorkoutMetrics
        import httpx
        from sqlalchemy.orm.attributes import flag_modified

        _backfill_status.update({
            "running": True, "phase": None,
            "streams_total": 0, "streams_done": 0,
            "metrics_total": 0, "metrics_done": 0,
            "last_result": None,
        })
        streams_updated = streams_skipped = streams_errors = 0
        metrics_processed = metrics_skipped = metrics_errors = 0

        try:
            bdb = SessionLocal()

            # ── Phase 1: Streams ─────────────────────────────────────────────
            _backfill_status["phase"] = "streams"
            candidates = (
                bdb.query(Workout)
                .filter(
                    Workout.source == "intervals_icu",
                    Workout.track_points != None,
                    Workout.garmin_activity_id != None,
                )
                .all()
            )
            # Sentinel: 'power' key absent → imported before full stream set was added
            needs_streams = [
                w for w in candidates
                if w.track_points and "power" not in w.track_points[0]
            ]
            _backfill_status["streams_total"] = len(needs_streams)
            logger.info(f"Backfill streams: {len(needs_streams)} workouts need re-fetch")

            for workout in needs_streams:
                act_id = workout.garmin_activity_id.replace("icu_", "")
                try:
                    streams = intervals_service.fetch_streams(api_key, act_id)
                    new_pts = intervals_service.build_track_points(streams) if streams else None

                    if new_pts:
                        workout.track_points = new_pts
                        flag_modified(workout, "track_points")
                        bdb.commit()
                        streams_updated += 1
                    else:
                        # No usable streams — stamp each point with power=None so
                        # this workout is skipped on any future backfill run.
                        for pt in workout.track_points:
                            pt.setdefault("power", None)
                        flag_modified(workout, "track_points")
                        bdb.commit()
                        streams_skipped += 1
                except Exception as e:
                    logger.warning(f"Stream backfill error for {act_id}: {e}")
                    bdb.rollback()
                    streams_errors += 1
                _backfill_status["streams_done"] += 1

            # ── Phase 2: Metrics ─────────────────────────────────────────────
            _backfill_status["phase"] = "metrics"
            existing_ids = {r.workout_id for r in bdb.query(WorkoutMetrics.workout_id).all()}
            needs_metrics = (
                bdb.query(Workout)
                .filter(Workout.garmin_activity_id.like("icu_%"))
                .all()
            )
            needs_metrics = [w for w in needs_metrics if w.id not in existing_ids]
            _backfill_status["metrics_total"] = len(needs_metrics)
            logger.info(f"Backfill metrics: {len(needs_metrics)} activities need metrics")

            # Resolve real athlete ID from the first activity if needed
            real_athlete_id = athlete_id
            if athlete_id == "0" and needs_metrics:
                try:
                    first_id = needs_metrics[0].garmin_activity_id.replace("icu_", "")
                    url = f"https://intervals.icu/api/v1/activity/{first_id}"
                    with httpx.Client(timeout=30) as client:
                        r = client.get(url, auth=("API_KEY", api_key))
                        if r.status_code == 200:
                            real_athlete_id = str(r.json().get("athlete_id", athlete_id))
                except Exception:
                    pass

            for workout in needs_metrics:
                act_id = workout.garmin_activity_id.replace("icu_", "")
                try:
                    url = f"https://intervals.icu/api/v1/athlete/{real_athlete_id}/activities"
                    with httpx.Client(timeout=30) as client:
                        r = client.get(url, auth=("API_KEY", api_key), params={
                            "oldest": workout.started_at.strftime("%Y-%m-%d"),
                            "newest": workout.started_at.strftime("%Y-%m-%d"),
                            "fields": METRICS_FIELDS,
                        })
                    if r.status_code != 200:
                        metrics_errors += 1
                        _backfill_status["metrics_done"] += 1
                        continue
                    acts = r.json()
                    act = next((a for a in acts if str(a.get("id")) == act_id), None)
                    if act is None:
                        metrics_skipped += 1
                        _backfill_status["metrics_done"] += 1
                        continue
                    metrics = intervals_service.extract_metrics(act)
                    if any(v is not None for v in metrics.values()):
                        m = WorkoutMetrics(workout_id=workout.id, **metrics)
                        bdb.merge(m)
                        bdb.commit()
                        metrics_processed += 1
                    else:
                        metrics_skipped += 1
                except Exception as e:
                    logger.warning(f"Metrics backfill error for {act_id}: {e}")
                    bdb.rollback()
                    metrics_errors += 1
                _backfill_status["metrics_done"] += 1

            bdb.close()
            _backfill_status["last_result"] = {
                "streams_updated": streams_updated,
                "streams_skipped": streams_skipped,
                "streams_errors":  streams_errors,
                "metrics_processed": metrics_processed,
                "metrics_skipped":   metrics_skipped,
                "metrics_errors":    metrics_errors,
            }
            logger.info(
                f"Backfill complete — streams: updated={streams_updated} "
                f"skipped={streams_skipped} errors={streams_errors} | "
                f"metrics: processed={metrics_processed} "
                f"skipped={metrics_skipped} errors={metrics_errors}"
            )
        except Exception as e:
            logger.error(f"Backfill failed: {e}")
            _backfill_status["last_result"] = {
                "streams_updated": streams_updated, "streams_skipped": streams_skipped,
                "streams_errors": streams_errors, "metrics_processed": metrics_processed,
                "metrics_skipped": metrics_skipped, "metrics_errors": metrics_errors,
                "error": str(e),
            }
        finally:
            _backfill_status["running"] = False
            _backfill_status["phase"] = None
            invalidate_stats_cache()

    background_tasks.add_task(run)
    return {"ok": True, "message": "Backfill started in background"}


@router.get("/backfill/status")
def backfill_status():
    return _backfill_status
