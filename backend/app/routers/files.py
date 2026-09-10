from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Workout
from app.schemas import WorkoutResponse
from app.services.gpx_parser import parse_gpx
from app.services.fit_parser import parse_fit
from app.services.tcx_parser import parse_tcx
from app.services.kml_parser import parse_kml, parse_kmz
from app.cache import invalidate_stats_cache

router = APIRouter(prefix="/api/import", tags=["import"])


def _guess_sport_from_filename(filename: str) -> str:
    name = filename.lower()
    if "run" in name:
        return "running"
    if "cycl" in name or "bike" in name or "ride" in name:
        return "cycling"
    if "swim" in name:
        return "swimming"
    if "hike" in name or "trail" in name:
        return "hiking"
    if "walk" in name:
        return "walking"
    return "other"


@router.post("/gpx", response_model=WorkoutResponse)
async def import_gpx(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith(".gpx"):
        raise HTTPException(status_code=400, detail="File must be a .gpx file")
    content = await file.read()
    try:
        data = parse_gpx(content)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse GPX: {e}")

    if not data.get("sport"):
        data["sport"] = _guess_sport_from_filename(file.filename)

    workout = Workout(
        **{k: v for k, v in data.items() if hasattr(Workout, k)},
        source="gpx_file",
        original_filename=file.filename,
    )
    db.add(workout)
    db.commit()
    invalidate_stats_cache()
    db.refresh(workout)
    return WorkoutResponse.from_orm_with_track_flag(workout)


@router.post("/fit", response_model=WorkoutResponse)
async def import_fit(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith(".fit"):
        raise HTTPException(status_code=400, detail="File must be a .fit file")
    content = await file.read()
    try:
        data = parse_fit(content)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse FIT: {e}")

    workout = Workout(
        **{k: v for k, v in data.items() if hasattr(Workout, k)},
        source="fit_file",
        original_filename=file.filename,
    )
    db.add(workout)
    db.commit()
    invalidate_stats_cache()
    db.refresh(workout)
    return WorkoutResponse.from_orm_with_track_flag(workout)


@router.post("/tcx", response_model=WorkoutResponse)
async def import_tcx(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith(".tcx"):
        raise HTTPException(status_code=400, detail="File must be a .tcx file")
    content = await file.read()
    try:
        data = parse_tcx(content)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse TCX: {e}")

    workout = Workout(
        **{k: v for k, v in data.items() if hasattr(Workout, k)},
        source="tcx_file",
        original_filename=file.filename,
    )
    db.add(workout)
    db.commit()
    invalidate_stats_cache()
    db.refresh(workout)
    return WorkoutResponse.from_orm_with_track_flag(workout)


@router.post("/kml", response_model=WorkoutResponse)
async def import_kml(file: UploadFile = File(...), db: Session = Depends(get_db)):
    fname = file.filename.lower()
    if not (fname.endswith(".kml") or fname.endswith(".kmz")):
        raise HTTPException(status_code=400, detail="File must be a .kml or .kmz file")
    content = await file.read()
    try:
        data = parse_kmz(content) if fname.endswith(".kmz") else parse_kml(content)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse KML/KMZ: {e}")

    if not data.get("sport"):
        data["sport"] = _guess_sport_from_filename(file.filename)

    workout = Workout(
        **{k: v for k, v in data.items() if hasattr(Workout, k)},
        source="kml_file",
        original_filename=file.filename,
    )
    db.add(workout)
    db.commit()
    invalidate_stats_cache()
    db.refresh(workout)
    return WorkoutResponse.from_orm_with_track_flag(workout)


@router.post("/upload", response_model=WorkoutResponse)
async def import_any(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Auto-detect file type and import .gpx / .fit / .tcx / .kml / .kmz."""
    fname = file.filename.lower()
    content = await file.read()

    parsers = {
        ".gpx":  (lambda c: parse_gpx(c),  "gpx_file"),
        ".fit":  (lambda c: parse_fit(c),  "fit_file"),
        ".tcx":  (lambda c: parse_tcx(c),  "tcx_file"),
        ".kml":  (lambda c: parse_kml(c),  "kml_file"),
        ".kmz":  (lambda c: parse_kmz(c),  "kmz_file"),
    }

    ext = None
    for candidate in parsers:
        if fname.endswith(candidate):
            ext = candidate
            break

    if ext is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Accepted: {', '.join(parsers)}"
        )

    parse_fn, source_tag = parsers[ext]
    try:
        data = parse_fn(content)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse file: {e}")

    if not data.get("sport"):
        data["sport"] = _guess_sport_from_filename(file.filename)

    workout = Workout(
        **{k: v for k, v in data.items() if hasattr(Workout, k)},
        source=source_tag,
        original_filename=file.filename,
    )
    db.add(workout)
    db.commit()
    invalidate_stats_cache()
    db.refresh(workout)
    return WorkoutResponse.from_orm_with_track_flag(workout)
