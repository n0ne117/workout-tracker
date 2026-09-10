from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import AppSettings
from app.schemas import SettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _get_or_create_settings(db: Session) -> AppSettings:
    settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if not settings:
        settings = AppSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.patch("")
def update_settings(update: SettingsUpdate, db: Session = Depends(get_db)):
    settings = _get_or_create_settings(db)
    if update.garmin_email is not None:
        settings.garmin_email = update.garmin_email
    if update.garmin_sync_days_back is not None:
        settings.garmin_sync_days_back = update.garmin_sync_days_back
    db.commit()
    return {"ok": True}
