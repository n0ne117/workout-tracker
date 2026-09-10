from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = "sqlite:////data/workouts.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _migrate_db()


def _migrate_db():
    """
    Add columns introduced after the initial schema was created.
    SQLite only supports ADD COLUMN (no IF NOT EXISTS), so we check PRAGMA first.
    New tables are handled by create_all above — only ALTER TABLE is needed here.
    """
    # (table, column_name, sqlite_type)
    migrations = [
        ("app_settings", "intervals_athlete_id",      "TEXT"),
        ("app_settings", "updated_at",                "DATETIME"),
        ("app_settings", "runlab_target_distances",   "TEXT"),
        ("app_settings", "runlab_hr_max",             "INTEGER"),
        ("app_settings", "runlab_hr_lthr",            "INTEGER"),
    ]

    with engine.connect() as conn:
        for table, column, col_type in migrations:
            rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            existing_cols = {row[1] for row in rows}   # row[1] = column name
            if column not in existing_cols:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
                conn.commit()

        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_workout_gear_gear_id ON workout_gear (gear_id)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_workouts_started_at ON workouts (started_at)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_workouts_sport ON workouts (sport)"
        ))
        conn.commit()
