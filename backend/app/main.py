import asyncio
import math
import json
import os
from contextlib import asynccontextmanager, suppress
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.database import init_db
from app.routers import workouts, files, intervals, gear, challenges, race_calendar, backup, runlab


class _SafeEncoder(json.JSONEncoder):
    """Replace inf / -inf / nan with None so responses never crash."""
    def iterencode(self, o, _one_shot=False):
        return super().iterencode(self._sanitize(o), _one_shot)

    def _sanitize(self, obj):
        if isinstance(obj, float):
            return None if not math.isfinite(obj) else obj
        if isinstance(obj, dict):
            return {k: self._sanitize(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [self._sanitize(v) for v in obj]
        return obj


@asynccontextmanager
async def lifespan(app: FastAPI):
    # on_event("startup") is deprecated in FastAPI 0.115.
    init_db()
    _seed_challenges()

    from app.services import sync_scheduler
    scheduler = asyncio.create_task(sync_scheduler.run())
    try:
        yield
    finally:
        scheduler.cancel()
        with suppress(asyncio.CancelledError):
            await scheduler


app = FastAPI(title="Workout Tracker", version="1.2.1", lifespan=lifespan)
app.router.default_response_class = JSONResponse

# Monkey-patch starlette's JSON serialisation to tolerate inf/nan
import starlette.responses as _sr
_orig_render = _sr.JSONResponse.render
def _safe_render(self, content):
    return json.dumps(
        _SafeEncoder()._sanitize(content),
        ensure_ascii=False,
        allow_nan=False,
        indent=None,
        separators=(",", ":"),
    ).encode("utf-8")
_sr.JSONResponse.render = _safe_render

app.add_middleware(
    CORSMiddleware,
    # The UI is served same-origin through nginx, so CORS only matters for
    # local development. Credentials with a wildcard origin is a combination
    # browsers reject outright, and there are no cookies to send anyway.
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workouts.router)
app.include_router(files.router)
app.include_router(intervals.router)
app.include_router(gear.router)
app.include_router(challenges.router)
app.include_router(race_calendar.router)
app.include_router(backup.router)
app.include_router(runlab.router)


SEED_PATH = Path(os.environ.get("DATA_DIR", "/data")) / "challenges_seed.json"


def _seed_challenges():
    """
    Seed the challenge list from /data/challenges_seed.json on a fresh database.

    The rows used to be a literal in this file — 28 personal Conqueror
    purchases with dates and prices, which is user data living in source and
    shipped to anyone who clones the repo. The file lives beside the database
    in the git-ignored data volume; if it's absent, seeding is simply skipped
    and challenges can be added through the UI.
    """
    from app.database import SessionLocal
    from app.models import ChallengeItem

    if not SEED_PATH.exists():
        return

    try:
        rows = json.loads(SEED_PATH.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        print(f"[seed] ignoring {SEED_PATH}: {exc}")
        return

    def parse_date(value):
        return datetime.strptime(value, "%Y-%m-%d") if value else None

    db = SessionLocal()
    try:
        if db.query(ChallengeItem).count() > 0:
            return
        # Ignore keys the model no longer has, so a seed file written by an
        # older version (which carried cost_eur) still loads.
        known = {c.name for c in ChallengeItem.__table__.columns}
        items = [
            ChallengeItem(**{
                **{k: v for k, v in row.items() if k in known},
                **{k: parse_date(row.get(k))
                   for k in ("purchase_date", "use_before", "start_date", "end_date")},
            })
            for row in rows
        ]
        db.add_all(items)
        db.commit()
        print(f"[seed] inserted {len(items)} challenges from {SEED_PATH}")
    finally:
        db.close()





@app.get("/api/health")
def health():
    return {"status": "ok"}
