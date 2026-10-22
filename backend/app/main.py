import asyncio
import math
import json
import os
from contextlib import asynccontextmanager, suppress
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from app.database import init_db
from app.routers import workouts, files, intervals, gear, challenges, race_calendar, backup, runlab, wellness


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


app = FastAPI(title="Workout Tracker", version="1.7.0", lifespan=lifespan)
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

# The UI is served same-origin through nginx (and the Vite dev server proxies
# /api), so no cross-origin access is needed. A wildcard here let any web page
# open in a browser on the LAN read the whole history — GPS tracks included —
# or delete it, since the API has no login. CORS_ORIGINS opts specific origins
# back in, comma-separated, for anyone calling the API from another app.
_cors_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.middleware("http")
async def _refuse_cross_site_writes(request: Request, call_next):
    """
    CORS only hides responses; a plain form or multipart POST from another
    site still reaches the API — enough to upload a restore that replaces
    everything. Browsers send Origin on such requests, so a write whose
    origin is another host is refused. Hostnames only: nginx forwards $host,
    which drops the port.
    """
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("origin")
        host = urlparse("//" + request.headers.get("host", "")).hostname
        if origin and origin not in _cors_origins and urlparse(origin).hostname != host:
            return JSONResponse({"detail": "Cross-site request refused"}, status_code=403)
    return await call_next(request)

app.include_router(workouts.router)
app.include_router(files.router)
app.include_router(intervals.router)
app.include_router(gear.router)
app.include_router(challenges.router)
app.include_router(race_calendar.router)
app.include_router(backup.router)
app.include_router(runlab.router)
app.include_router(wellness.router)


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
    """
    Healthy means the database answers and its directory takes writes.

    Docker's healthcheck and the UI's offline banner both read this; a bare
    "ok" stayed green while /data was unwritable — after a failed chown, say —
    and every save was failing.
    """
    from app.database import engine, DATABASE_URL, DATA_DIR

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT count(*) FROM workouts"))
    except Exception as exc:  # noqa: BLE001 - any failure is the answer
        return JSONResponse({"status": "error", "detail": f"database: {exc}"}, status_code=503)
    if DATABASE_URL.startswith("sqlite") and not os.access(DATA_DIR, os.W_OK):
        return JSONResponse({"status": "error", "detail": f"{DATA_DIR} is not writable"}, status_code=503)
    return {"status": "ok"}
