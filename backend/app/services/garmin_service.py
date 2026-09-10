import json
import threading
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from garminconnect import Garmin
from sqlalchemy.orm import Session
from app.models import AppSettings, Workout
import logging

logger = logging.getLogger(__name__)

# In-memory store for pending MFA logins: login_token -> state dict
_pending_logins: dict = {}
_pending_lock = threading.Lock()

SPORT_MAP = {
    "running": "running",
    "trail_running": "trail_running",
    "cycling": "cycling",
    "mountain_biking": "mountain_biking",
    "swimming": "swimming",
    "open_water_swimming": "open_water_swimming",
    "hiking": "hiking",
    "walking": "walking",
    "indoor_cycling": "indoor_cycling",
    "fitness_equipment": "cross_training",
    "strength_training": "strength_training",
    "yoga": "yoga",
    "tennis": "tennis",
    "basketball": "basketball",
    "soccer": "soccer",
    "rowing": "rowing",
    "skiing": "skiing",
    "snowboarding": "snowboarding",
    "multi_sport": "triathlon",
    "resort_skiing_snowboarding": "skiing",
    "virtual_ride": "indoor_cycling",
    "treadmill_running": "running",
    "lap_swimming": "swimming",
    "cardio": "cross_training",
    "other": "other",
}


def _map_sport(garmin_type: str) -> str:
    if not garmin_type:
        return "other"
    key = garmin_type.lower().replace(" ", "_")
    return SPORT_MAP.get(key, "other")


def get_garmin_client(settings: AppSettings) -> Optional[Garmin]:
    if not settings.garmin_token_store:
        return None
    try:
        client = Garmin()
        client.garth.loads(settings.garmin_token_store)
        client.display_name = settings.garmin_email
        return client
    except Exception as e:
        logger.warning(f"Could not restore Garmin session: {e}")
        return None


def start_login(email: str, password: str) -> dict:
    """
    Start a Garmin login. Returns one of:
      {"done": True, "token_store": "..."}          – logged in without MFA
      {"mfa_required": True, "login_token": "..."}  – waiting for MFA code
    Raises on hard error (wrong password, rate limit, etc.)
    """
    login_token = str(uuid.uuid4())
    mfa_event = threading.Event()
    state = {
        "mfa_event": mfa_event,
        "mfa_code": None,
        "token_store": None,
        "error": None,
        "needs_mfa": threading.Event(),   # set when prompt_mfa is called
        "done": threading.Event(),        # set when login thread finishes
    }

    def prompt_mfa() -> str:
        state["needs_mfa"].set()
        logger.info("Garmin MFA required, waiting for code…")
        mfa_event.wait(timeout=300)  # 5-minute window to enter code
        return state["mfa_code"] or ""

    def do_login():
        try:
            client = Garmin(email, password, prompt_mfa=prompt_mfa)
            client.login()
            state["token_store"] = client.garth.dumps()
        except Exception as e:
            state["error"] = str(e)
        finally:
            state["done"].set()

    t = threading.Thread(target=do_login, daemon=True)
    with _pending_lock:
        _pending_logins[login_token] = state

    t.start()

    # Wait up to 8 seconds: either MFA prompt fires, login completes, or error
    finished = state["done"].wait(timeout=8)
    mfa_needed = state["needs_mfa"].is_set()

    if finished and not mfa_needed:
        # Login completed (success or error) before MFA was needed
        with _pending_lock:
            _pending_logins.pop(login_token, None)
        if state["error"]:
            raise Exception(state["error"])
        return {"done": True, "token_store": state["token_store"]}

    if mfa_needed:
        # Thread is paused waiting for MFA code
        return {"mfa_required": True, "login_token": login_token}

    # Still running after 8s with no MFA prompt — keep waiting in background
    # (shouldn't normally happen, but handle gracefully)
    return {"mfa_required": True, "login_token": login_token}


def complete_mfa(login_token: str, mfa_code: str) -> str:
    """Submit MFA code and return token_store on success."""
    with _pending_lock:
        state = _pending_logins.get(login_token)
    if not state:
        raise Exception("Login session not found or expired")

    state["mfa_code"] = mfa_code
    state["mfa_event"].set()

    # Wait for login thread to finish
    finished = state["done"].wait(timeout=30)
    with _pending_lock:
        _pending_logins.pop(login_token, None)

    if not finished:
        raise Exception("Login timed out after MFA submission")
    if state["error"]:
        raise Exception(state["error"])
    return state["token_store"]


def sync_activities(db: Session, days_back: int = 30) -> dict:
    settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if not settings or not settings.garmin_token_store:
        return {"error": "Garmin not connected", "imported": 0, "skipped": 0}

    client = get_garmin_client(settings)
    if not client:
        return {"error": "Could not connect to Garmin", "imported": 0, "skipped": 0}

    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days_back)

    try:
        activities = client.get_activities_by_date(
            start_date.strftime("%Y-%m-%d"),
            end_date.strftime("%Y-%m-%d"),
        )
    except Exception as e:
        logger.error(f"Error fetching activities: {e}")
        return {"error": str(e), "imported": 0, "skipped": 0}

    imported = 0
    skipped = 0

    for act in activities:
        activity_id = str(act.get("activityId", ""))
        if not activity_id:
            continue

        existing = db.query(Workout).filter(Workout.garmin_activity_id == activity_id).first()
        if existing:
            skipped += 1
            continue

        try:
            workout = _activity_to_workout(client, act, activity_id)
            db.add(workout)
            db.commit()
            imported += 1
        except Exception as e:
            logger.error(f"Error importing activity {activity_id}: {e}")
            db.rollback()

    settings.garmin_last_sync = datetime.now(timezone.utc)
    db.commit()

    return {"imported": imported, "skipped": skipped, "error": None}


def _activity_to_workout(client: Garmin, act: dict, activity_id: str) -> Workout:
    sport_type = act.get("activityType", {}).get("typeKey", "other")
    sport = _map_sport(sport_type)

    start_str = act.get("startTimeLocal") or act.get("startTimeGMT")
    started_at = None
    if start_str:
        try:
            started_at = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
            if started_at.tzinfo is None:
                started_at = started_at.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    if not started_at:
        started_at = datetime.now(timezone.utc)

    title = act.get("activityName") or f"{sport.replace('_', ' ').title()} – {started_at.strftime('%b %d, %Y')}"

    distance = act.get("distance")
    duration = act.get("duration")
    moving_time = act.get("movingDuration")
    elevation_gain = act.get("elevationGain")
    elevation_loss = act.get("elevationLoss")
    avg_hr = act.get("averageHR")
    max_hr = act.get("maxHR")
    avg_speed = act.get("averageSpeed")
    max_speed = act.get("maxSpeed")
    avg_cad = act.get("averageBikingCadenceInRevPerMinute") or act.get("averageRunningCadenceInStepsPerMinute")
    avg_power = act.get("avgPower")
    calories = act.get("calories")

    track_points = None
    bbox_min_lat = bbox_max_lat = bbox_min_lon = bbox_max_lon = None

    if act.get("minLatitude"):
        bbox_min_lat = act["minLatitude"]
        bbox_max_lat = act["maxLatitude"]
        bbox_min_lon = act["minLongitude"]
        bbox_max_lon = act["maxLongitude"]

    try:
        gpx_data = client.download_activity(int(activity_id), dl_fmt=client.ActivityDownloadFormat.GPX)
        if gpx_data:
            from app.services.gpx_parser import parse_gpx
            parsed = parse_gpx(gpx_data)
            track_points = parsed.get("track_points")
            if parsed.get("bbox_min_lat"):
                bbox_min_lat = parsed["bbox_min_lat"]
                bbox_max_lat = parsed["bbox_max_lat"]
                bbox_min_lon = parsed["bbox_min_lon"]
                bbox_max_lon = parsed["bbox_max_lon"]
    except Exception as e:
        logger.warning(f"Could not download GPX for {activity_id}: {e}")

    return Workout(
        title=title,
        sport=sport,
        started_at=started_at,
        duration_seconds=int(duration) if duration else None,
        moving_time_seconds=int(moving_time) if moving_time else None,
        distance_meters=float(distance) if distance else None,
        elevation_gain_meters=float(elevation_gain) if elevation_gain else None,
        elevation_loss_meters=float(elevation_loss) if elevation_loss else None,
        avg_heart_rate=int(avg_hr) if avg_hr else None,
        max_heart_rate=int(max_hr) if max_hr else None,
        avg_speed_ms=float(avg_speed) if avg_speed else None,
        max_speed_ms=float(max_speed) if max_speed else None,
        avg_cadence=int(avg_cad) if avg_cad else None,
        avg_power_watts=int(avg_power) if avg_power else None,
        calories=int(calories) if calories else None,
        source="garmin",
        garmin_activity_id=activity_id,
        track_points=track_points,
        bbox_min_lat=bbox_min_lat,
        bbox_max_lat=bbox_max_lat,
        bbox_min_lon=bbox_min_lon,
        bbox_max_lon=bbox_max_lon,
    )
