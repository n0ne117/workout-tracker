import math
import json
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


app = FastAPI(title="Workout Tracker", version="1.0.0")
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
    allow_origins=["*"],
    allow_credentials=True,
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


def _seed_challenges():
    from datetime import datetime
    from app.database import SessionLocal
    from app.models import ChallengeItem

    db = SessionLocal()
    try:
        if db.query(ChallengeItem).count() > 0:
            return

        def d(s):
            return datetime.strptime(s, "%d.%m.%Y") if s else None

        # Seed rows removed from published history: they were personal
        # Conqueror purchases (names, dates, prices). Current versions read
        # them from /data/challenges_seed.json, which is git-ignored.
        rows = []
        db.add_all([ChallengeItem(**r) for r in rows])
        db.commit()
    finally:
        db.close()


@app.on_event("startup")
def startup():
    init_db()
    _seed_challenges()


@app.get("/api/health")
def health():
    return {"status": "ok"}
