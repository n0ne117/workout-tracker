from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


SPORT_CATEGORIES = [
    "basketball",
    "calisthenics",
    "climbing",
    "cross_training",
    "cycling",
    "diving",
    "hiking",
    "ice_skating",
    "indoor_cycling",
    "indoor_rowing",
    "inline_skating",
    "jump_rope",
    "motorbiking",
    "mountain_biking",
    "open_water_swimming",
    "playing",
    "power_circle",
    "rowing",
    "running",
    "skiing",
    "snorkeling",
    "snowboarding",
    "soccer",
    "strength_training",
    "sup",
    "swimming",
    "tennis",
    "trail_running",
    "triathlon",
    "walking",
    "yoga",
    "other",
]


class Workout(Base):
    __tablename__ = "workouts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    sport = Column(String, default="other")
    started_at = Column(DateTime, nullable=False)
    duration_seconds = Column(Integer, nullable=True)  # total elapsed time
    moving_time_seconds = Column(Integer, nullable=True)
    distance_meters = Column(Float, nullable=True)
    elevation_gain_meters = Column(Float, nullable=True)
    elevation_loss_meters = Column(Float, nullable=True)
    avg_heart_rate = Column(Integer, nullable=True)
    max_heart_rate = Column(Integer, nullable=True)
    avg_speed_ms = Column(Float, nullable=True)
    max_speed_ms = Column(Float, nullable=True)
    avg_cadence = Column(Integer, nullable=True)
    avg_power_watts = Column(Integer, nullable=True)
    calories = Column(Integer, nullable=True)
    is_race = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    # GPS track as list of {lat, lon, ele, time} objects
    track_points = Column(JSON, nullable=True)
    # Bounding box for quick map rendering
    bbox_min_lat = Column(Float, nullable=True)
    bbox_max_lat = Column(Float, nullable=True)
    bbox_min_lon = Column(Float, nullable=True)
    bbox_max_lon = Column(Float, nullable=True)
    # Source info
    source = Column(String, default="manual")  # intervals_icu | fit_file | gpx_file | manual
    garmin_activity_id = Column(String, nullable=True, unique=True, index=True)
    original_filename = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


GEAR_TYPES = ["shoes", "bike", "motorcycle"]


class GearItem(Base):
    __tablename__ = "gear_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # shoes | bike | motorcycle
    note = Column(Text, nullable=True)
    max_range = Column(Float, nullable=True)       # None = no limit
    max_range_unit = Column(String, default="km")  # km | hours
    retired = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class WorkoutGear(Base):
    """Many-to-many link between workouts and gear items."""
    __tablename__ = "workout_gear"

    workout_id = Column(Integer, ForeignKey("workouts.id"), primary_key=True)
    gear_id = Column(Integer, ForeignKey("gear_items.id"), primary_key=True)


RACE_STATUSES = ["planned", "registered", "completed", "dnf", "dns", "maybe"]


class RaceEntry(Base):
    __tablename__ = "race_calendar"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    distance = Column(String, nullable=True)    # flexible: "42.195 km", "Half Marathon", "10K"
    date = Column(DateTime, nullable=False)
    location = Column(String, nullable=True)
    website = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String, default="planned")  # planned|registered|completed|dnf|dns|maybe
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ChallengeItem(Base):
    __tablename__ = "challenges"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    distance_km = Column(Integer, nullable=False)
    purchase_date = Column(DateTime, nullable=True)
    use_before = Column(DateTime, nullable=True)   # expiry for unstarted challenges
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    year = Column(Integer, nullable=True)           # Jahr — attributed year
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class WorkoutMetrics(Base):
    __tablename__ = "workout_metrics"

    workout_id          = Column(Integer, ForeignKey("workouts.id", ondelete="CASCADE"), primary_key=True)
    icu_training_load   = Column(Float, nullable=True)
    icu_atl             = Column(Float, nullable=True)
    icu_ctl             = Column(Float, nullable=True)
    trimp               = Column(Float, nullable=True)
    icu_hr_zone_times   = Column(JSON,  nullable=True)
    icu_zone_times      = Column(JSON,  nullable=True)
    perceived_exertion  = Column(Integer, nullable=True)
    icu_intensity       = Column(Float, nullable=True)
    icu_efficiency_factor = Column(Float, nullable=True)
    icu_decoupling      = Column(Float, nullable=True)
    updated_at          = Column(DateTime, server_default=func.now(), onupdate=func.now())


class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, default=1)
    intervals_api_key = Column(String, nullable=True)
    intervals_athlete_id = Column(String, nullable=True, default="0")
    runlab_target_distances = Column(JSON, nullable=True)   # default ['5k']
    runlab_hr_max           = Column(Integer, nullable=True)
    runlab_hr_lthr          = Column(Integer, nullable=True)
    # ── Scheduled Intervals.icu sync ──────────────────────────────────────────
    sync_enabled          = Column(Boolean, default=True)
    sync_interval_minutes = Column(Integer, default=60)
    sync_days_back        = Column(Integer, default=30)
    last_sync_at          = Column(DateTime, nullable=True)
    last_sync_result      = Column(JSON, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
