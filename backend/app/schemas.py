from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Any
from datetime import datetime


class WorkoutBase(BaseModel):
    title: str
    sport: str = "other"
    started_at: datetime
    duration_seconds: Optional[int] = None
    moving_time_seconds: Optional[int] = None
    distance_meters: Optional[float] = None
    elevation_gain_meters: Optional[float] = None
    elevation_loss_meters: Optional[float] = None
    avg_heart_rate: Optional[int] = None
    max_heart_rate: Optional[int] = None
    avg_speed_ms: Optional[float] = None
    max_speed_ms: Optional[float] = None
    avg_cadence: Optional[int] = None
    avg_power_watts: Optional[int] = None
    calories: Optional[int] = None
    is_race: bool = False
    notes: Optional[str] = None


class WorkoutCreate(WorkoutBase):
    pass


class WorkoutUpdate(BaseModel):
    title: Optional[str] = None
    sport: Optional[str] = None
    is_race: Optional[bool] = None
    notes: Optional[str] = None
    started_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    moving_time_seconds: Optional[int] = None
    distance_meters: Optional[float] = None
    elevation_gain_meters: Optional[float] = None
    avg_heart_rate: Optional[int] = None
    max_heart_rate: Optional[int] = None
    calories: Optional[int] = None


class WorkoutResponse(WorkoutBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    garmin_activity_id: Optional[str] = None
    original_filename: Optional[str] = None
    has_track: bool = False
    bbox_min_lat: Optional[float] = None
    bbox_max_lat: Optional[float] = None
    bbox_min_lon: Optional[float] = None
    bbox_max_lon: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    @classmethod
    def from_orm_with_track_flag(cls, workout, has_track=None):
        """
        Build a response without ever reading track_points.

        Pass `has_track` when the column is deferred — otherwise touching
        `workout.track_points` would lazy-load a several-hundred-KB blob per
        row, which is exactly what deferring it was meant to avoid.
        """
        data = {
            c.name: getattr(workout, c.name)
            for c in workout.__table__.columns
            if c.name != "track_points"
        }
        data["has_track"] = bool(workout.track_points) if has_track is None else has_track
        return cls(**data)


class WorkoutDetail(WorkoutResponse):
    track_points: Optional[List[Any]] = None
    icu_hr_zone_times: Optional[List[Any]] = None
    icu_zone_times: Optional[List[Any]] = None


class WorkoutListResponse(BaseModel):
    items: List[WorkoutResponse]
    total: int
    page: int
    page_size: int


class GearBase(BaseModel):
    name: str
    type: str
    note: Optional[str] = None
    max_range: Optional[float] = None
    max_range_unit: str = "km"
    retired: bool = False


class GearCreate(GearBase):
    pass


class GearUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    note: Optional[str] = None
    max_range: Optional[float] = None
    max_range_unit: Optional[str] = None
    retired: Optional[bool] = None


class GearResponse(GearBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Computed from linked workouts
    distance_km: float = 0.0
    duration_hours: float = 0.0
    activity_count: int = 0
    days_count: int = 0


class RaceEntryBase(BaseModel):
    name: str
    distance: Optional[str] = None
    date: datetime
    location: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None
    status: str = "planned"


class RaceEntryCreate(RaceEntryBase):
    pass


class RaceEntryUpdate(BaseModel):
    name: Optional[str] = None
    distance: Optional[str] = None
    date: Optional[datetime] = None
    location: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class RaceEntryResponse(RaceEntryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None


class ChallengeBase(BaseModel):
    name: str
    distance_km: int
    purchase_date: Optional[datetime] = None
    use_before: Optional[datetime] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    year: Optional[int] = None
    notes: Optional[str] = None


class ChallengeCreate(ChallengeBase):
    pass


class ChallengeUpdate(BaseModel):
    name: Optional[str] = None
    distance_km: Optional[int] = None
    purchase_date: Optional[datetime] = None
    use_before: Optional[datetime] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    year: Optional[int] = None
    notes: Optional[str] = None


class ChallengeResponse(ChallengeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None


class TrimRequest(BaseModel):
    start_index: int
    end_index: int
