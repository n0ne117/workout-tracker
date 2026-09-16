"""
What counts as the same activity twice.

Intervals.icu can hold several records for one physical activity — a re-upload
from the watch, a re-sync, a re-processed copy — each with its own id. Matching
on that id alone let every variant in as a separate workout.

Two activities of the same sport cannot begin at the same instant, so
(started_at, sport) is the identity. The evidence in real data is a 2015 ride
stored three times with identical start *and* identical duration, differing
only in distance (19.3 / 23.3 / 23.3 km) and whether a GPS track came with it.

Both the import guard and the "duplicates" list filter read this module, so the
rule the importer enforces is exactly the rule the UI shows you.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.models import Workout


def find_twin(db: Session, started_at, sport, exclude_id=None):
    """The already-stored workout this one would duplicate, or None."""
    q = db.query(Workout).filter(
        Workout.started_at == started_at,
        Workout.sport == sport,
    )
    if exclude_id is not None:
        q = q.filter(Workout.id != exclude_id)
    return q.first()


def shares_identity_clause():
    """
    Clause matching workouts that share their identity with another row.

    A correlated EXISTS rather than a row-value IN: portable, and it lets
    SQLite use the started_at index instead of grouping the whole table.
    """
    other = aliased(Workout)
    return (
        select(1)
        .where(
            other.started_at == Workout.started_at,
            other.sport == Workout.sport,
            other.id != Workout.id,
        )
        .exists()
    )
