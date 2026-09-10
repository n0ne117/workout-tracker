from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import AppSettings
from app.schemas import SettingsResponse, SettingsUpdate, GarminSyncRequest
from app.services import garmin_service
from app.cache import invalidate_stats_cache
import logging

router = APIRouter(prefix="/api/garmin", tags=["garmin"])
logger = logging.getLogger(__name__)

_sync_status = {"running": False, "last_result": None}


class MFAPayload(BaseModel):
    login_token: str
    mfa_code: str


def _get_or_create_settings(db: Session) -> AppSettings:
    settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if not settings:
        settings = AppSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/status", response_model=SettingsResponse)
def get_garmin_status(db: Session = Depends(get_db)):
    settings = _get_or_create_settings(db)
    return SettingsResponse(
        garmin_email=settings.garmin_email,
        garmin_last_sync=settings.garmin_last_sync,
        garmin_sync_days_back=settings.garmin_sync_days_back or 30,
        garmin_connected=bool(settings.garmin_token_store),
    )


@router.post("/connect")
def connect_garmin(payload: SettingsUpdate, db: Session = Depends(get_db)):
    """
    Start login. Returns:
      {"ok": true}                                       – connected (no MFA)
      {"mfa_required": true, "login_token": "..."}       – MFA code needed
    """
    if not payload.garmin_email or not payload.garmin_password:
        raise HTTPException(status_code=400, detail="Email and password required")

    # Persist email + days_back regardless of MFA outcome
    settings = _get_or_create_settings(db)
    settings.garmin_email = payload.garmin_email
    if payload.garmin_sync_days_back:
        settings.garmin_sync_days_back = payload.garmin_sync_days_back
    db.commit()

    try:
        result = garmin_service.start_login(payload.garmin_email, payload.garmin_password)
    except Exception as e:
        msg = str(e)
        if "429" in msg or "Too Many Requests" in msg:
            raise HTTPException(
                status_code=429,
                detail="Garmin is rate-limiting login attempts from this IP. Please wait 15–30 minutes and try again.",
            )
        raise HTTPException(status_code=401, detail=f"Garmin login failed: {e}")

    if result.get("done"):
        settings.garmin_token_store = result["token_store"]
        db.commit()
        return {"ok": True, "message": "Connected to Garmin Connect"}

    # MFA required
    return {"mfa_required": True, "login_token": result["login_token"]}


@router.post("/connect/mfa")
def submit_mfa(payload: MFAPayload, db: Session = Depends(get_db)):
    """Submit the MFA code to complete login."""
    try:
        token_store = garmin_service.complete_mfa(payload.login_token, payload.mfa_code)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"MFA failed: {e}")

    settings = _get_or_create_settings(db)
    settings.garmin_token_store = token_store
    db.commit()
    return {"ok": True, "message": "Connected to Garmin Connect"}


@router.post("/disconnect")
def disconnect_garmin(db: Session = Depends(get_db)):
    settings = _get_or_create_settings(db)
    settings.garmin_token_store = None
    db.commit()
    return {"ok": True}


@router.get("/sync/status")
def get_sync_status():
    return _sync_status


@router.post("/sync")
def trigger_sync(
    request: GarminSyncRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if _sync_status["running"]:
        raise HTTPException(status_code=409, detail="Sync already running")

    settings = _get_or_create_settings(db)
    if not settings.garmin_token_store:
        raise HTTPException(status_code=400, detail="Garmin not connected")

    days_back = request.days_back or settings.garmin_sync_days_back or 30

    def run_sync():
        _sync_status["running"] = True
        try:
            from app.database import SessionLocal
            sync_db = SessionLocal()
            result = garmin_service.sync_activities(sync_db, days_back=days_back)
            sync_db.close()
            _sync_status["last_result"] = result
        except Exception as e:
            _sync_status["last_result"] = {"error": str(e), "imported": 0, "skipped": 0}
        finally:
            _sync_status["running"] = False
            invalidate_stats_cache()

    background_tasks.add_task(run_sync)
    return {"ok": True, "message": f"Syncing last {days_back} days in background"}
