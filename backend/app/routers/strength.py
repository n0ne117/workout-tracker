"""
Strength training: the sets of a session, the exercise catalog, templates.

A session is stored as flat sets — round, exercise position, set number,
weight, reps — and the page groups them by round. Saving replaces the
session's sets as a whole, so the editor never has to diff.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Exercise, StrengthSet, StrengthTemplate, Workout
from app.services.strength import MUSCLE_GROUPS, summarize, valid_groups

router = APIRouter(prefix="/api", tags=["strength"])


# ── Exercises ─────────────────────────────────────────────────────────────────

def _exercise_dict(e: Exercise) -> dict:
    return {"id": e.id, "name": e.name, "primary": e.primary or [], "secondary": e.secondary or [],
            "custom": bool(e.custom)}


class ExerciseIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    primary: List[str]
    secondary: List[str] = []


class ExercisePatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    primary: Optional[List[str]] = None
    secondary: Optional[List[str]] = None


@router.get("/strength/groups")
def muscle_groups():
    return MUSCLE_GROUPS


@router.get("/strength/exercises")
def list_exercises(db: Session = Depends(get_db)):
    return [_exercise_dict(e) for e in db.query(Exercise).order_by(Exercise.name).all()]


def _clean_groups(primary, secondary):
    primary = valid_groups(primary)
    if not primary:
        raise HTTPException(status_code=422, detail=f"Pick at least one main muscle group: {', '.join(MUSCLE_GROUPS)}")
    # A group is either main or assisting, never both.
    secondary = [g for g in valid_groups(secondary) if g not in primary]
    return primary, secondary


@router.post("/strength/exercises", status_code=201)
def create_exercise(body: ExerciseIn, db: Session = Depends(get_db)):
    name = body.name.strip()
    if db.query(Exercise).filter(Exercise.name == name).first():
        raise HTTPException(status_code=409, detail=f"“{name}” already exists")
    primary, secondary = _clean_groups(body.primary, body.secondary)
    ex = Exercise(name=name, primary=primary, secondary=secondary, custom=True)
    db.add(ex)
    db.commit()
    return _exercise_dict(ex)


@router.patch("/strength/exercises/{exercise_id}")
def update_exercise(exercise_id: int, body: ExercisePatch, db: Session = Depends(get_db)):
    ex = db.get(Exercise, exercise_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Exercise not found")
    if body.name is not None:
        name = body.name.strip()
        clash = db.query(Exercise).filter(Exercise.name == name, Exercise.id != ex.id).first()
        if clash:
            raise HTTPException(status_code=409, detail=f"“{name}” already exists")
        ex.name = name
    if body.primary is not None or body.secondary is not None:
        ex.primary, ex.secondary = _clean_groups(
            body.primary if body.primary is not None else ex.primary,
            body.secondary if body.secondary is not None else ex.secondary,
        )
    db.commit()
    return _exercise_dict(ex)


@router.delete("/strength/exercises/{exercise_id}")
def delete_exercise(exercise_id: int, db: Session = Depends(get_db)):
    ex = db.get(Exercise, exercise_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Exercise not found")
    if not ex.custom:
        raise HTTPException(status_code=400, detail="Catalog exercises can be renamed and edited, not deleted")
    if db.query(StrengthSet).filter(StrengthSet.exercise_id == ex.id).first():
        raise HTTPException(status_code=409, detail="Used in a workout — remove it from those first")
    db.delete(ex)
    db.commit()
    return {"ok": True}


@router.get("/strength/exercises/last")
def last_sets(ids: str, before: Optional[datetime] = None, db: Session = Depends(get_db)):
    """
    For each exercise, the sets from the most recent session that had it —
    what a new session pre-fills its weights and reps from.
    """
    wanted = [int(x) for x in ids.split(",") if x.strip().isdigit()]
    out = {}
    for ex_id in wanted:
        q = (db.query(Workout.id)
             .join(StrengthSet, StrengthSet.workout_id == Workout.id)
             .filter(StrengthSet.exercise_id == ex_id))
        if before:
            q = q.filter(Workout.started_at < before)
        latest = q.order_by(Workout.started_at.desc()).first()
        if latest:
            rows = (db.query(StrengthSet)
                    .filter(StrengthSet.workout_id == latest[0], StrengthSet.exercise_id == ex_id)
                    .order_by(StrengthSet.round, StrengthSet.set_no).all())
            out[ex_id] = [{"round": r.round, "set_no": r.set_no, "weight_kg": r.weight_kg, "reps": r.reps} for r in rows]
    return out


# ── A workout's sets ─────────────────────────────────────────────────────────

class SetIn(BaseModel):
    round: int = Field(default=1, ge=1, le=50)
    position: int = Field(default=1, ge=1, le=200)
    set_no: int = Field(default=1, ge=1, le=100)
    exercise_id: int
    weight_kg: Optional[float] = Field(default=None, ge=0, le=1000)
    reps: Optional[int] = Field(default=None, ge=0, le=1000)


class SetsIn(BaseModel):
    sets: List[SetIn]


def _session(workout_id: int, db: Session) -> dict:
    rows = (db.query(StrengthSet).filter(StrengthSet.workout_id == workout_id)
            .order_by(StrengthSet.round, StrengthSet.position, StrengthSet.set_no).all())
    sets = [{"round": r.round, "position": r.position, "set_no": r.set_no, "exercise_id": r.exercise_id,
             "weight_kg": r.weight_kg, "reps": r.reps} for r in rows]
    exercises = {e.id: e for e in db.query(Exercise).filter(Exercise.id.in_({s["exercise_id"] for s in sets})).all()} if sets else {}
    return {"sets": sets, "summary": summarize(sets, exercises)}


def _workout_or_404(workout_id: int, db: Session) -> Workout:
    w = db.get(Workout, workout_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workout not found")
    return w


@router.get("/workouts/{workout_id}/strength")
def get_strength(workout_id: int, db: Session = Depends(get_db)):
    _workout_or_404(workout_id, db)
    return _session(workout_id, db)


@router.put("/workouts/{workout_id}/strength")
def save_strength(workout_id: int, body: SetsIn, db: Session = Depends(get_db)):
    _workout_or_404(workout_id, db)
    ids = {s.exercise_id for s in body.sets}
    known = {i for (i,) in db.query(Exercise.id).filter(Exercise.id.in_(ids))} if ids else set()
    if ids - known:
        raise HTTPException(status_code=422, detail=f"Unknown exercise id(s): {sorted(ids - known)}")
    db.query(StrengthSet).filter(StrengthSet.workout_id == workout_id).delete()
    for s in body.sets:
        db.add(StrengthSet(workout_id=workout_id, **s.model_dump()))
    db.commit()
    return _session(workout_id, db)


@router.get("/workouts/{workout_id}/strength/previous")
def previous_session(workout_id: int, db: Session = Depends(get_db)):
    """The sets of the latest strength session before this one, for "Like last time"."""
    w = _workout_or_404(workout_id, db)
    prev = (db.query(Workout)
            .join(StrengthSet, StrengthSet.workout_id == Workout.id)
            .filter(Workout.id != w.id, Workout.started_at < w.started_at)
            .order_by(Workout.started_at.desc()).first())
    if not prev:
        return {"workout": None, "sets": []}
    return {"workout": {"id": prev.id, "title": prev.title, "started_at": prev.started_at.isoformat()},
            "sets": _session(prev.id, db)["sets"]}


# ── Templates ─────────────────────────────────────────────────────────────────

class TemplateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    rounds: int = Field(default=1, ge=1, le=20)
    exercise_ids: List[int] = Field(min_length=1)


def _template_dict(t: StrengthTemplate) -> dict:
    return {"id": t.id, "name": t.name, "rounds": t.rounds, "exercise_ids": t.exercise_ids}


@router.get("/strength/templates")
def list_templates(db: Session = Depends(get_db)):
    return [_template_dict(t) for t in db.query(StrengthTemplate).order_by(StrengthTemplate.name).all()]


@router.post("/strength/templates", status_code=201)
def create_template(body: TemplateIn, db: Session = Depends(get_db)):
    known = {i for (i,) in db.query(Exercise.id).filter(Exercise.id.in_(body.exercise_ids))}
    if set(body.exercise_ids) - known:
        raise HTTPException(status_code=422, detail="Template refers to unknown exercises")
    # Saving under an existing name updates that template.
    t = db.query(StrengthTemplate).filter(StrengthTemplate.name == body.name.strip()).first()
    if t is None:
        t = StrengthTemplate(name=body.name.strip())
        db.add(t)
    t.rounds, t.exercise_ids = body.rounds, body.exercise_ids
    db.commit()
    return _template_dict(t)


@router.delete("/strength/templates/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    t = db.get(StrengthTemplate, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(t)
    db.commit()
    return {"ok": True}
