import fitparse
from datetime import datetime, timezone
from typing import Optional
import math


SPORT_MAP = {
    "running": "running",
    "cycling": "cycling",
    "swimming": "swimming",
    "hiking": "hiking",
    "walking": "walking",
    "training": "strength_training",
    "fitness_equipment": "cross_training",
    "tennis": "tennis",
    "basketball": "basketball",
    "soccer": "soccer",
    "rowing": "rowing",
    "skiing": "skiing",
    "snowboarding": "snowboarding",
    "trail_running": "trail_running",
    "mountain_biking": "mountain_biking",
    "open_water": "open_water_swimming",
    "yoga": "yoga",
    "virtual_activity": "indoor_cycling",
    "e_biking": "cycling",
    "transition": "triathlon",
    "multi_sport": "triathlon",
}

SUB_SPORT_MAP = {
    "trail": "trail_running",
    "mountain": "mountain_biking",
    "indoor_cycling": "indoor_cycling",
    "spin": "indoor_cycling",
    "open_water": "open_water_swimming",
    "lap_swimming": "swimming",
    "road": "cycling",
    "track_cycling": "cycling",
    "treadmill": "running",
}


def parse_fit(content: bytes) -> dict:
    """Parse a FIT file and return workout data."""
    fitfile = fitparse.FitFile(content)

    session_data = {}
    track_points = []
    heart_rates = []
    cadences = []
    speeds = []

    min_lat = min_lon = float("inf")
    max_lat = max_lon = float("-inf")

    for record in fitfile.get_messages("session"):
        for field in record:
            session_data[field.name] = field.value

    for record in fitfile.get_messages("record"):
        fields = {f.name: f.value for f in record}

        lat = fields.get("position_lat")
        lon = fields.get("position_long")
        # FIT stores lat/lon as semicircles
        if lat is not None:
            lat = lat * (180.0 / 2**31)
        if lon is not None:
            lon = lon * (180.0 / 2**31)

        ele = fields.get("altitude") or fields.get("enhanced_altitude")
        t = fields.get("timestamp")
        hr = fields.get("heart_rate")
        cad = fields.get("cadence")
        speed = fields.get("speed") or fields.get("enhanced_speed")
        power = fields.get("power")
        # vertical_oscillation stored in mm by Garmin → convert to cm
        vo_raw = fields.get("vertical_oscillation")
        vertical_oscillation = round(vo_raw / 10, 1) if vo_raw is not None else None
        # stance_time is ground contact time in ms
        gct_raw = fields.get("stance_time")
        ground_contact_time = int(gct_raw) if gct_raw is not None else None
        # step_length stored in mm → convert to cm
        sl_raw = fields.get("step_length")
        stride_length = round(sl_raw / 10, 1) if sl_raw is not None else None

        if hr:
            heart_rates.append(hr)
        if cad:
            cadences.append(cad)
        if speed:
            speeds.append(speed)

        if lat is not None and lon is not None:
            min_lat = min(min_lat, lat)
            max_lat = max(max_lat, lat)
            min_lon = min(min_lon, lon)
            max_lon = max(max_lon, lon)

            track_points.append({
                "lat": lat,
                "lon": lon,
                "ele": ele,
                "time": t.isoformat() if t else None,
                "hr": hr,
                "cad": cad,
                "speed": speed,
                "power": power,
                "vertical_oscillation": vertical_oscillation,
                "ground_contact_time": ground_contact_time,
                "stride_length": stride_length,
            })

    # Determine sport
    sport_raw = str(session_data.get("sport", "")).lower()
    sub_sport_raw = str(session_data.get("sub_sport", "")).lower()
    sport = SUB_SPORT_MAP.get(sub_sport_raw) or SPORT_MAP.get(sport_raw) or "other"

    # Timestamps
    started_at = session_data.get("start_time")
    if started_at and started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)

    total_elapsed = session_data.get("total_elapsed_time")
    total_timer = session_data.get("total_timer_time")
    total_distance = session_data.get("total_distance")  # in meters
    total_ascent = session_data.get("total_ascent")
    total_descent = session_data.get("total_descent")
    avg_hr = session_data.get("avg_heart_rate")
    max_hr = session_data.get("max_heart_rate")
    avg_speed = session_data.get("avg_speed") or session_data.get("enhanced_avg_speed")
    max_speed = session_data.get("max_speed") or session_data.get("enhanced_max_speed")
    avg_cad = session_data.get("avg_cadence")
    avg_power = session_data.get("avg_power")
    calories = session_data.get("total_calories")
    nec_lat = session_data.get("nec_lat")
    nec_lon = session_data.get("nec_long")
    swc_lat = session_data.get("swc_lat")
    swc_lon = session_data.get("swc_long")

    if nec_lat is not None:
        nec_lat = nec_lat * (180.0 / 2**31)
        nec_lon = nec_lon * (180.0 / 2**31)
        swc_lat = swc_lat * (180.0 / 2**31)
        swc_lon = swc_lon * (180.0 / 2**31)
        min_lat = min(min_lat, swc_lat)
        max_lat = max(max_lat, nec_lat)
        min_lon = min(min_lon, swc_lon)
        max_lon = max(max_lon, nec_lon)

    title = f"{sport.replace('_', ' ').title()} Activity"
    if started_at:
        title = f"{sport.replace('_', ' ').title()} – {started_at.strftime('%b %d, %Y')}"

    return {
        "title": title,
        "sport": sport,
        "started_at": started_at or datetime.now(timezone.utc),
        "duration_seconds": int(total_elapsed) if total_elapsed else None,
        "moving_time_seconds": int(total_timer) if total_timer else None,
        "distance_meters": float(total_distance) if total_distance else None,
        "elevation_gain_meters": float(total_ascent) if total_ascent else None,
        "elevation_loss_meters": float(total_descent) if total_descent else None,
        "avg_heart_rate": int(avg_hr) if avg_hr else None,
        "max_heart_rate": int(max_hr) if max_hr else None,
        "avg_speed_ms": float(avg_speed) if avg_speed else None,
        "max_speed_ms": float(max_speed) if max_speed else None,
        "avg_cadence": int(avg_cad) if avg_cad else None,
        "avg_power_watts": int(avg_power) if avg_power else None,
        "calories": int(calories) if calories else None,
        "track_points": track_points if track_points else None,
        "bbox_min_lat": min_lat if min_lat != float("inf") else None,
        "bbox_max_lat": max_lat if max_lat != float("-inf") else None,
        "bbox_min_lon": min_lon if min_lon != float("inf") else None,
        "bbox_max_lon": max_lon if max_lon != float("-inf") else None,
    }
