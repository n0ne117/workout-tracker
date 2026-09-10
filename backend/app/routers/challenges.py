from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import ChallengeItem
from app.schemas import ChallengeCreate, ChallengeUpdate, ChallengeResponse

router = APIRouter(prefix="/api/challenges", tags=["challenges"])


@router.get("", response_model=List[ChallengeResponse])
def list_challenges(db: Session = Depends(get_db)):
    return db.query(ChallengeItem).order_by(ChallengeItem.id).all()


@router.get("/{challenge_id}", response_model=ChallengeResponse)
def get_challenge(challenge_id: int, db: Session = Depends(get_db)):
    item = db.query(ChallengeItem).filter(ChallengeItem.id == challenge_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return item


@router.post("", response_model=ChallengeResponse, status_code=201)
def create_challenge(payload: ChallengeCreate, db: Session = Depends(get_db)):
    item = ChallengeItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{challenge_id}", response_model=ChallengeResponse)
def update_challenge(challenge_id: int, payload: ChallengeUpdate, db: Session = Depends(get_db)):
    item = db.query(ChallengeItem).filter(ChallengeItem.id == challenge_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Challenge not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{challenge_id}")
def delete_challenge(challenge_id: int, db: Session = Depends(get_db)):
    item = db.query(ChallengeItem).filter(ChallengeItem.id == challenge_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Challenge not found")
    db.delete(item)
    db.commit()
    return {"ok": True}
