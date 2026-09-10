from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import RaceEntry, RACE_STATUSES
from app.schemas import RaceEntryCreate, RaceEntryUpdate, RaceEntryResponse

router = APIRouter(prefix="/api/race-calendar", tags=["race-calendar"])


@router.get("", response_model=List[RaceEntryResponse])
def list_races(db: Session = Depends(get_db)):
    return db.query(RaceEntry).order_by(RaceEntry.date).all()


@router.get("/{race_id}", response_model=RaceEntryResponse)
def get_race(race_id: int, db: Session = Depends(get_db)):
    item = db.query(RaceEntry).filter(RaceEntry.id == race_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Race not found")
    return item


@router.post("", response_model=RaceEntryResponse, status_code=201)
def create_race(payload: RaceEntryCreate, db: Session = Depends(get_db)):
    if payload.status not in RACE_STATUSES:
        raise HTTPException(status_code=422, detail=f"status must be one of {RACE_STATUSES}")
    item = RaceEntry(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{race_id}", response_model=RaceEntryResponse)
def update_race(race_id: int, payload: RaceEntryUpdate, db: Session = Depends(get_db)):
    item = db.query(RaceEntry).filter(RaceEntry.id == race_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Race not found")
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and data["status"] not in RACE_STATUSES:
        raise HTTPException(status_code=422, detail=f"status must be one of {RACE_STATUSES}")
    for field, value in data.items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{race_id}")
def delete_race(race_id: int, db: Session = Depends(get_db)):
    item = db.query(RaceEntry).filter(RaceEntry.id == race_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Race not found")
    db.delete(item)
    db.commit()
    return {"ok": True}
