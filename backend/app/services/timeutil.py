"""
How start times are stored.

Workout.started_at holds naive local wall-clock time: the Intervals.icu
importer has always stored start_date_local, the UI renders the value as-is,
and the heatmap and calendar group by its date. File formats carry UTC, so
their times are converted here — otherwise a FIT upload of a run Intervals
already synced lands hours away and the duplicate check never sees it.
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def _local_zone():
    """The container's TZ, or None to fall back to the system's local zone."""
    name = os.environ.get("TZ")
    if name:
        try:
            return ZoneInfo(name)
        except (ZoneInfoNotFoundError, ValueError):
            pass
    return None


def to_local(dt: Optional[datetime], utc_offset: Optional[timedelta] = None) -> Optional[datetime]:
    """
    A UTC (or naive-UTC) datetime as naive local wall-clock time.

    utc_offset, when the source records one (FIT does), wins over TZ: it is the
    offset where the activity happened, not where the server runs.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    if utc_offset is not None:
        return (dt.astimezone(timezone.utc) + utc_offset).replace(tzinfo=None)
    return dt.astimezone(_local_zone()).replace(tzinfo=None)


def now_local() -> datetime:
    return to_local(datetime.now(timezone.utc))


# Sources whose started_at was stored as UTC before file times were converted.
FILE_SOURCES = ("fit_file", "gpx_file", "tcx_file", "kml_file", "kmz_file")


def zone_is_utc() -> bool:
    """True when local time is UTC all year, so converting changes nothing."""
    return all(
        to_local(datetime(2026, month, 1, 12)) == datetime(2026, month, 1, 12)
        for month in (1, 7)
    )
