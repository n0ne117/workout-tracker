"""
Periodic Intervals.icu sync.

A single asyncio task started from the app lifespan. It wakes once a minute
and asks whether a sync is due, rather than sleeping for the whole interval:
that way a changed interval takes effect immediately instead of after the
current sleep expires, and a restart doesn't lose track of when the last sync
happened — `last_sync_at` lives in the database, not in memory.

The work itself runs through the same `_execute_import` the Sync button uses,
on a worker thread so the blocking HTTP and SQLite calls never stall the loop.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

# How often to re-evaluate whether a sync is due.
TICK_SECONDS = 60

# Guard rail: a 1-minute schedule would hammer the API and achieve nothing,
# since an import takes longer than that.
MIN_INTERVAL_MINUTES = 5
DEFAULT_INTERVAL_MINUTES = 60
DEFAULT_DAYS_BACK = 30


def _due(settings, now: datetime) -> bool:
    """Whether a scheduled sync should start right now."""
    if not getattr(settings, "sync_enabled", False):
        return False
    if not getattr(settings, "intervals_api_key", None):
        return False  # nothing to sync against yet

    interval = max(
        MIN_INTERVAL_MINUTES,
        getattr(settings, "sync_interval_minutes", None) or DEFAULT_INTERVAL_MINUTES,
    )
    last = getattr(settings, "last_sync_at", None)
    if last is None:
        return True
    return now - last >= timedelta(minutes=interval)


async def _tick() -> None:
    from app.database import SessionLocal
    from app.models import AppSettings
    from app.routers import intervals as intervals_router

    # Never overlap with a run already in flight, whoever started it.
    if intervals_router._import_status["running"]:
        return

    db = SessionLocal()
    try:
        settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
        if settings is None:
            return

        # Compare naive local timestamps — last_sync_at is stored naive, and
        # mixing an aware "now" into that subtraction raises TypeError.
        now = datetime.now()
        if not _due(settings, now):
            return

        api_key = settings.intervals_api_key
        athlete_id = settings.intervals_athlete_id or "0"
        days_back = settings.sync_days_back or DEFAULT_DAYS_BACK

        end = datetime.now(timezone.utc)
        oldest = (end - timedelta(days=days_back)).strftime("%Y-%m-%d")
        newest = end.strftime("%Y-%m-%d")
    finally:
        db.close()

    logger.info("Scheduled Intervals.icu sync starting (%s days back)", days_back)
    await asyncio.to_thread(
        intervals_router._execute_import, api_key, athlete_id, oldest, newest
    )

    # Record the attempt whether or not it imported anything: the point of the
    # stamp is to pace the schedule, and a failing sync that never stamps would
    # retry every single tick.
    db = SessionLocal()
    try:
        settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
        if settings is not None:
            settings.last_sync_at = datetime.now()
            settings.last_sync_result = intervals_router._import_status.get("last_result")
            db.commit()
    finally:
        db.close()

    logger.info(
        "Scheduled sync finished: %s", intervals_router._import_status.get("last_result")
    )


async def run() -> None:
    """Loop until cancelled. One misbehaving tick must not kill the scheduler."""
    logger.info("Sync scheduler started (tick %ss)", TICK_SECONDS)
    try:
        while True:
            try:
                await _tick()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Scheduled sync tick failed; continuing")
            await asyncio.sleep(TICK_SECONDS)
    except asyncio.CancelledError:
        logger.info("Sync scheduler stopped")
        raise
