import os
from datetime import datetime

from sqlalchemy import bindparam, create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# DATA_DIR lets the published all-in-one image relocate the database without a
# rebuild; DATABASE_URL overrides it outright for anything non-SQLite.
DATA_DIR = os.environ.get("DATA_DIR", "/data")
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    f"sqlite:///{os.path.join(DATA_DIR, 'workouts.db')}",
)

# check_same_thread is a SQLite-only argument, so only pass it for SQLite.
_connect_args = (
    {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

engine = create_engine(DATABASE_URL, connect_args=_connect_args)
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
    _convert_file_times()


# PRAGMA user_version records which one-off data migrations have run.
FILE_TIMES_LOCAL = 1


def _convert_file_times():
    """
    Convert the start times of older file imports from UTC to local time.

    started_at is local wall-clock time, but the file parsers used to store
    UTC, so those workouts showed hours off and never matched their Intervals
    copy. FIT files carried the real offset, but the files are not kept, so
    the container's TZ stands in for every format.

    Runs once. It cannot wait for TZ to be set: FIT imports from then on carry
    the watch's own offset whatever TZ says, and would be shifted twice.
    """
    from app.services.timeutil import FILE_SOURCES, to_local, zone_is_utc

    with engine.connect() as conn:
        if conn.execute(text("PRAGMA user_version")).scalar() >= FILE_TIMES_LOCAL:
            return
        rows = conn.execute(
            text("SELECT id, started_at FROM workouts WHERE source IN :sources")
            .bindparams(bindparam("sources", expanding=True)),
            {"sources": list(FILE_SOURCES)},
        ).fetchall()
        if rows and zone_is_utc():
            print(f"[migrate] TZ is UTC, so {len(rows)} file-imported workouts keep "
                  "their UTC start times")
            rows = []
        for workout_id, started_at in rows:
            local = to_local(datetime.fromisoformat(started_at))
            conn.execute(
                text("UPDATE workouts SET started_at = :t WHERE id = :id"),
                {"t": local.strftime("%Y-%m-%d %H:%M:%S.%f"), "id": workout_id},
            )
        conn.execute(text(f"PRAGMA user_version = {FILE_TIMES_LOCAL}"))
        conn.commit()
        if rows:
            print(f"[migrate] converted {len(rows)} file-imported workouts to local time")


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
        ("app_settings", "sync_enabled",              "BOOLEAN"),
        ("app_settings", "sync_interval_minutes",     "INTEGER"),
        ("app_settings", "sync_days_back",            "INTEGER"),
        ("app_settings", "last_sync_at",              "DATETIME"),
        ("app_settings", "last_sync_result",          "TEXT"),
    ]

    # Columns removed from the model. SQLite has supported DROP COLUMN since
    # 3.35; on anything older the drop simply fails and the column lingers
    # harmlessly, which is why this never raises.
    drops = [
        ("challenges", "cost_eur"),   # prices were never shown in the UI
    ]

    with engine.connect() as conn:
        for table, column in drops:
            rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            if column in {row[1] for row in rows}:
                try:
                    conn.execute(text(f"ALTER TABLE {table} DROP COLUMN {column}"))
                    conn.commit()
                except Exception as exc:  # noqa: BLE001 - never block startup
                    print(f"[migrate] could not drop {table}.{column}: {exc}")

        for table, column, col_type in migrations:
            rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            existing_cols = {row[1] for row in rows}   # row[1] = column name
            if column not in existing_cols:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
                conn.commit()

        # ADD COLUMN leaves existing rows NULL whatever the model default says,
        # so seed the schedule settings — otherwise the scheduler reads NULL
        # and reasonably concludes syncing is switched off.
        for _col, _val in (
            ("sync_enabled", 1),
            ("sync_interval_minutes", 60),
            ("sync_days_back", 30),
        ):
            conn.execute(
                text(f"UPDATE app_settings SET {_col} = :v WHERE {_col} IS NULL"),
                {"v": _val},
            )
        conn.commit()

        # Deleting a workout used to leave its metrics row behind (SQLite does
        # not enforce the ON DELETE CASCADE without PRAGMA foreign_keys), and
        # SQLite hands a freed id to the next insert — so a new workout could
        # inherit a dead one's zones and training load. A metrics row is always
        # written after its workout, so one older than its workout is stale.
        conn.execute(text(
            "DELETE FROM workout_metrics WHERE workout_id NOT IN (SELECT id FROM workouts)"
        ))
        conn.execute(text(
            "DELETE FROM workout_metrics WHERE workout_id IN ("
            "  SELECT m.workout_id FROM workout_metrics m"
            "  JOIN workouts w ON w.id = m.workout_id"
            "  WHERE m.updated_at < w.created_at)"
        ))
        conn.execute(text(
            "DELETE FROM workout_gear WHERE workout_id NOT IN (SELECT id FROM workouts)"
            " OR gear_id NOT IN (SELECT id FROM gear_items)"
        ))
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
