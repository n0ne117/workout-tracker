import io
import json
import zipfile
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Workout, GearItem, WorkoutGear, RaceEntry, ChallengeItem

router = APIRouter(prefix="/api/backup", tags=["backup"])

MANIFEST_VERSION = "1"


# ── helpers ────────────────────────────────────────────────────────────────────

def _dt(v):
    """datetime → ISO string, or None."""
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.isoformat()
    return v


def _parse_dt(v):
    """ISO string → datetime, or None."""
    if not v:
        return None
    try:
        return datetime.fromisoformat(v)
    except (ValueError, TypeError):
        return None


def _workout_to_dict(w: Workout) -> dict:
    return {
        "id": w.id,
        "title": w.title,
        "sport": w.sport,
        "started_at": _dt(w.started_at),
        "duration_seconds": w.duration_seconds,
        "moving_time_seconds": w.moving_time_seconds,
        "distance_meters": w.distance_meters,
        "elevation_gain_meters": w.elevation_gain_meters,
        "elevation_loss_meters": w.elevation_loss_meters,
        "avg_heart_rate": w.avg_heart_rate,
        "max_heart_rate": w.max_heart_rate,
        "avg_speed_ms": w.avg_speed_ms,
        "max_speed_ms": w.max_speed_ms,
        "avg_cadence": w.avg_cadence,
        "avg_power_watts": w.avg_power_watts,
        "calories": w.calories,
        "is_race": w.is_race,
        "notes": w.notes,
        "track_points": w.track_points,
        "bbox_min_lat": w.bbox_min_lat,
        "bbox_max_lat": w.bbox_max_lat,
        "bbox_min_lon": w.bbox_min_lon,
        "bbox_max_lon": w.bbox_max_lon,
        "source": w.source,
        "garmin_activity_id": w.garmin_activity_id,
        "original_filename": w.original_filename,
        "created_at": _dt(w.created_at),
        "updated_at": _dt(w.updated_at),
    }


def _gear_to_dict(g: GearItem) -> dict:
    return {
        "id": g.id,
        "name": g.name,
        "type": g.type,
        "note": g.note,
        "max_range": g.max_range,
        "max_range_unit": g.max_range_unit,
        "retired": g.retired,
        "created_at": _dt(g.created_at),
        "updated_at": _dt(g.updated_at),
    }


def _race_to_dict(r: RaceEntry) -> dict:
    return {
        "id": r.id,
        "name": r.name,
        "distance": r.distance,
        "date": _dt(r.date),
        "location": r.location,
        "website": r.website,
        "notes": r.notes,
        "status": r.status,
        "created_at": _dt(r.created_at),
        "updated_at": _dt(r.updated_at),
    }


def _challenge_to_dict(c: ChallengeItem) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "distance_km": c.distance_km,
        "purchase_date": _dt(c.purchase_date),
        "use_before": _dt(c.use_before),
        "start_date": _dt(c.start_date),
        "end_date": _dt(c.end_date),
        "year": c.year,
        "notes": c.notes,
        "created_at": _dt(c.created_at),
        "updated_at": _dt(c.updated_at),
    }


def _build_zip(payload: dict, filename: str) -> StreamingResponse:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in payload.items():
            # Strings and bytes go in verbatim so callers can mix GPX or CSV
            # members into an otherwise-JSON archive.
            if isinstance(data, (str, bytes)):
                zf.writestr(name, data)
            else:
                zf.writestr(name, json.dumps(data, ensure_ascii=False, indent=2))
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── endpoints ──────────────────────────────────────────────────────────────────

@router.get("/workouts")
def backup_workouts(db: Session = Depends(get_db)):
    """Download a ZIP archive containing all workouts."""
    workouts = db.query(Workout).order_by(Workout.started_at).all()
    manifest = {
        "version": MANIFEST_VERSION,
        "type": "workouts",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "counts": {"workouts": len(workouts)},
    }
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return _build_zip(
        {
            "manifest.json": manifest,
            "workouts.json": [_workout_to_dict(w) for w in workouts],
        },
        f"workouts_backup_{ts}.zip",
    )


@router.get("/full")
def backup_full(db: Session = Depends(get_db)):
    """Download a ZIP archive containing all data."""
    workouts   = db.query(Workout).order_by(Workout.started_at).all()
    gear       = db.query(GearItem).all()
    wg_rows    = db.query(WorkoutGear).all()
    races      = db.query(RaceEntry).order_by(RaceEntry.date).all()
    challenges = db.query(ChallengeItem).all()

    manifest = {
        "version": MANIFEST_VERSION,
        "type": "full",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "counts": {
            "workouts": len(workouts),
            "gear": len(gear),
            "workout_gear": len(wg_rows),
            "races": len(races),
            "challenges": len(challenges),
        },
    }
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return _build_zip(
        {
            "manifest.json": manifest,
            "workouts.json": [_workout_to_dict(w) for w in workouts],
            "gear.json": [_gear_to_dict(g) for g in gear],
            "workout_gear.json": [{"workout_id": r.workout_id, "gear_id": r.gear_id} for r in wg_rows],
            "races.json": [_race_to_dict(r) for r in races],
            "challenges.json": [_challenge_to_dict(c) for c in challenges],
        },
        f"full_backup_{ts}.zip",
    )


@router.post("/restore")
async def restore_backup(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Restore data from a backup ZIP. Existing data is replaced."""
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="File must be a .zip archive")

    content = await file.read()
    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid ZIP archive")

    names = zf.namelist()
    if "manifest.json" not in names:
        raise HTTPException(status_code=400, detail="Archive is missing manifest.json — not a valid backup")

    manifest = json.loads(zf.read("manifest.json"))
    backup_type = manifest.get("type", "workouts")
    version = manifest.get("version", "1")
    if version != MANIFEST_VERSION:
        raise HTTPException(status_code=400, detail=f"Unsupported backup version: {version}")

    stats = {"restored": {}, "errors": []}

    # ── Workouts ────────────────────────────────────────────────────────────
    if "workouts.json" in names:
        rows = json.loads(zf.read("workouts.json"))
        # Delete existing workouts (and their gear links)
        db.query(WorkoutGear).delete()
        db.query(Workout).delete()
        db.flush()

        id_map = {}  # old_id → new_id (for workout_gear restore)
        imported = 0
        for row in rows:
            old_id = row.pop("id", None)
            row.pop("created_at", None)
            row.pop("updated_at", None)
            row["started_at"] = _parse_dt(row.get("started_at")) or datetime.now(timezone.utc)
            w = Workout(**{k: v for k, v in row.items() if hasattr(Workout, k)})
            db.add(w)
            db.flush()
            if old_id is not None:
                id_map[old_id] = w.id
            imported += 1
        stats["restored"]["workouts"] = imported

    # ── Gear ────────────────────────────────────────────────────────────────
    if "gear.json" in names and backup_type == "full":
        rows = json.loads(zf.read("gear.json"))
        db.query(GearItem).delete()
        db.flush()

        gear_id_map = {}
        imported = 0
        for row in rows:
            old_id = row.pop("id", None)
            row.pop("created_at", None)
            row.pop("updated_at", None)
            g = GearItem(**{k: v for k, v in row.items() if hasattr(GearItem, k)})
            db.add(g)
            db.flush()
            if old_id is not None:
                gear_id_map[old_id] = g.id
            imported += 1
        stats["restored"]["gear"] = imported

        # ── WorkoutGear links ────────────────────────────────────────────────
        if "workout_gear.json" in names:
            links = json.loads(zf.read("workout_gear.json"))
            count = 0
            for link in links:
                new_wid = id_map.get(link["workout_id"])
                new_gid = gear_id_map.get(link["gear_id"])
                if new_wid and new_gid:
                    db.add(WorkoutGear(workout_id=new_wid, gear_id=new_gid))
                    count += 1
            stats["restored"]["workout_gear"] = count

    # ── Races ────────────────────────────────────────────────────────────────
    if "races.json" in names and backup_type == "full":
        rows = json.loads(zf.read("races.json"))
        db.query(RaceEntry).delete()
        db.flush()

        imported = 0
        for row in rows:
            row.pop("id", None)
            row.pop("created_at", None)
            row.pop("updated_at", None)
            row["date"] = _parse_dt(row.get("date")) or datetime.now(timezone.utc)
            r = RaceEntry(**{k: v for k, v in row.items() if hasattr(RaceEntry, k)})
            db.add(r)
            imported += 1
        stats["restored"]["races"] = imported

    # ── Challenges ───────────────────────────────────────────────────────────
    if "challenges.json" in names and backup_type == "full":
        rows = json.loads(zf.read("challenges.json"))
        db.query(ChallengeItem).delete()
        db.flush()

        imported = 0
        for row in rows:
            row.pop("id", None)
            row.pop("created_at", None)
            row.pop("updated_at", None)
            for df in ("purchase_date", "use_before", "start_date", "end_date"):
                row[df] = _parse_dt(row.get(df))
            c = ChallengeItem(**{k: v for k, v in row.items() if hasattr(ChallengeItem, k)})
            db.add(c)
            imported += 1
        stats["restored"]["challenges"] = imported

    db.commit()
    return {"ok": True, "backup_type": backup_type, "stats": stats}
