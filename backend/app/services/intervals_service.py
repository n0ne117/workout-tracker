"""
Intervals.icu API integration.

Auth:  HTTP Basic — username = "API_KEY", password = <your api key>
Base:  https://intervals.icu/api/v1

Key endpoints used:
  GET /athlete/{id}/activities          list activities (oldest/newest date range)
  GET /activity/{id}/streams            time-series GPS / HR / power streams
"""

import httpx
import logging
import math
from datetime import datetime, timezone
from typing import Optional


logger = logging.getLogger(__name__)

BASE = "https://intervals.icu/api/v1"

SPORT_MAP = {
    "Run":               "running",
    "TrailRun":          "trail_running",
    "VirtualRun":        "running",
    "Ride":              "cycling",
    "GravelRide":        "cycling",
    "VirtualRide":       "indoor_cycling",
    "MountainBikeRide":  "mountain_biking",
    "EBikeRide":         "cycling",
    "Swim":              "swimming",
    "OpenWaterSwim":     "open_water_swimming",
    "Hike":              "hiking",
    "Walk":              "walking",
    "WeightTraining":    "strength_training",
    "Workout":           "cross_training",
    "Yoga":              "yoga",
    "Rowing":            "rowing",
    "AlpineSki":         "skiing",
    "Snowboard":         "snowboarding",
    "Tennis":            "tennis",
    "Soccer":            "soccer",
    "Basketball":        "basketball",
    "Triathlon":         "triathlon",
    "Crossfit":          "cross_training",
    "Elliptical":        "cross_training",
    "StairStepper":      "cross_training",
    "Other":             "other",
}


def _f(val):
    """Return val as float, or None if it is None / NaN / ±Inf."""
    if val is None:
        return None
    try:
        f = float(val)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def _i(val):
    """Return val as int via _f, or None."""
    f = _f(val)
    return int(f) if f is not None else None


def _auth(api_key: str):
    return ("API_KEY", api_key)


def _map_sport(type_str: str) -> str:
    if not type_str:
        return "other"
    return SPORT_MAP.get(type_str, "other")


def _parse_dt(s) -> Optional[datetime]:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _decode_polyline(encoded: str) -> list:
    """
    Decode a Google-encoded polyline into [[lat, lon], ...].
    Used as fallback when streams don't contain GPS data.
    """
    if not encoded:
        return []
    points = []
    index = lat = lng = 0
    while index < len(encoded):
        for is_lng in (False, True):
            result = shift = 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            val = ~(result >> 1) if (result & 1) else (result >> 1)
            if is_lng:
                lng += val
            else:
                lat += val
        points.append([lat / 1e5, lng / 1e5])
    return points


def fetch_activities(api_key: str, athlete_id: str, oldest: str, newest: str) -> list:
    """
    Returns raw list of activity dicts from intervals.icu.
    oldest / newest: 'YYYY-MM-DD'
    """
    url = f"{BASE}/athlete/{athlete_id}/activities"
    fields = (
        "id,start_date_local,start_date,type,sport_type,name,distance,elapsed_time,"
        "elapsed_time_raw,moving_time,total_elevation_gain,elevation_gain,elevation_loss,"
        "average_heartrate,max_heartrate,average_speed,max_speed,average_cadence,"
        "average_watts,calories,kilojoules,map,polyline,summary_polyline,athlete_id,"
        "icu_training_load,icu_atl,icu_ctl,trimp,icu_hr_zone_times,icu_zone_times,"
        "perceived_exertion,icu_intensity,icu_efficiency_factor,icu_decoupling"
    )
    params = {"oldest": oldest, "newest": newest, "fields": fields}
    with httpx.Client(timeout=30) as client:
        r = client.get(url, auth=_auth(api_key), params=params)
        r.raise_for_status()
        return r.json()


def _fetch_streams_url(api_key: str, url: str, params: Optional[dict],
                       dbg: Optional[list]) -> Optional[dict]:
    """Inner helper: fetch one streams URL, normalise, return dict or None."""
    label = url + (f"?{params}" if params else "")
    if dbg is not None:
        dbg.append(f"  GET {label}")
    try:
        with httpx.Client(timeout=30) as client:
            r = client.get(url, auth=_auth(api_key), params=params or {})
            if dbg is not None:
                dbg.append(f"  → HTTP {r.status_code}")
            if r.status_code in (404, 204):
                return None
            r.raise_for_status()
            raw = r.json()
            if isinstance(raw, list):
                result = {}
                for item in raw:
                    if "type" not in item or "data" not in item:
                        continue
                    result[item["type"]] = item["data"]
                    # latlng uses data2 for longitude (data = lat, data2 = lon)
                    if item["type"] == "latlng" and "data2" in item:
                        result["lng"] = item["data2"]
                if dbg is not None:
                    dbg.append(f"  → keys: {list(result.keys())}")
                return result
            if isinstance(raw, dict):
                if dbg is not None:
                    dbg.append(f"  → keys: {list(raw.keys())}")
                return raw
            return None
    except Exception as e:
        if dbg is not None:
            dbg.append(f"  → exception: {e}")
        logger.warning(f"fetch_streams {url}: {e}")
        return None


def fetch_streams(api_key: str, activity_id: str,
                  dbg: Optional[list] = None) -> Optional[dict]:
    """
    Fetch streams for an activity.  Tries two requests:
      1. Default (returns latlng as lat-only for some activity sources)
      2. Explicit lat+lng keys to get them as separate streams
    Returns merged dict or None.
    """
    base_url = f"{BASE}/activity/{activity_id}/streams"

    # Attempt 1: default streams
    streams = _fetch_streams_url(api_key, base_url, None, dbg)
    if streams is None:
        if dbg is not None:
            dbg.append(f"  → no streams available")
        return None

    # Check if latlng is lat-only (one value per time step)
    latlng = streams.get("latlng")
    time_s = streams.get("time")
    lat_only = (latlng and time_s and len(latlng) == len(time_s)
                and not isinstance(next((v for v in latlng if v is not None), None), (list, tuple)))

    if dbg is not None:
        _dbg_gps(streams, dbg)

    if not lat_only:
        return streams  # already have usable GPS or no GPS at all

    # Attempt 2: request lat and lng as explicit separate keys
    if dbg is not None:
        dbg.append(f"  latlng is lat-only → retrying with explicit lat/lng keys")

    for param_name in ("keys", "types"):
        explicit = _fetch_streams_url(
            api_key, base_url,
            {param_name: "lat,lng,altitude,heartrate,cadence,time,distance,"
                         "watts,vertical_oscillation,ground_contact_time,stride_length"},
            dbg,
        )
        if explicit and ("lat" in explicit or "lng" in explicit or "lon" in explicit):
            if dbg is not None:
                dbg.append(f"  → got explicit lat/lng via param '{param_name}' ✓")
            # Merge non-GPS keys from original response, GPS keys from explicit
            merged = {**streams, **explicit}
            return merged
        if dbg is not None:
            dbg.append(f"  → param '{param_name}' did not return separate lat/lng")

    # Nothing worked — return original (build_track_points will detect lat-only and skip GPS)
    return streams


def fetch_fit_gps(api_key: str, activity_id: str,
                  dbg: Optional[list] = None) -> Optional[list]:
    """
    Download the original FIT file for an activity and extract GPS track points.
    Used as fallback when the streams endpoint only returns latitude.
    """
    import io
    import fitparse

    url = f"{BASE}/activity/{activity_id}/fit"
    if dbg is not None:
        dbg.append(f"  FIT fallback: GET {url}")
    try:
        with httpx.Client(timeout=60) as client:
            r = client.get(url, auth=_auth(api_key))
            if dbg is not None:
                dbg.append(f"  → FIT HTTP {r.status_code}, "
                           f"content-type: {r.headers.get('content-type', '?')}, "
                           f"size: {len(r.content)} bytes")
            if r.status_code != 200:
                return None

        fitfile = fitparse.FitFile(io.BytesIO(r.content))
        pts: list = []
        for record in fitfile.get_messages("record"):
            d = {f.name: f.value for f in record}
            lat = d.get("position_lat")
            lon = d.get("position_long")
            if lat is None or lon is None:
                continue
            # fitparse returns semicircles for Garmin FIT files; convert to degrees
            if isinstance(lat, int):
                lat = lat * (180.0 / 2 ** 31)
                lon = lon * (180.0 / 2 ** 31)
            if not (math.isfinite(lat) and math.isfinite(lon)):
                continue
            if abs(lat) < 0.001 and abs(lon) < 0.001:
                continue
            ele = d.get("enhanced_altitude") or d.get("altitude")
            spd = d.get("enhanced_speed") or d.get("speed")
            # Garmin FIT stores vertical_oscillation in mm; charts expect cm
            raw_vo = _f(d.get("vertical_oscillation"))
            vo_cm  = round(raw_vo / 10, 1) if raw_vo is not None else None
            pts.append({
                "lat":                  lat,
                "lon":                  lon,
                "ele":                  _f(ele),
                "time":                 None,
                "hr":                   _i(d.get("heart_rate")),
                "cad":                  _i(d.get("cadence")),
                "speed":                _f(spd),           # m/s
                "power":                _i(d.get("power")),
                "vertical_oscillation": vo_cm,             # cm
                "ground_contact_time":  _i(d.get("ground_contact_time")),  # ms
                "stride_length":        _f(d.get("stride_length")),        # cm
            })

        if dbg is not None:
            if pts:
                dbg.append(f"  → FIT GPS: {len(pts)} pts, "
                           f"first=({pts[0]['lat']:.5f}, {pts[0]['lon']:.5f}) ✓")
            else:
                dbg.append(f"  → FIT parsed but 0 GPS points found")
        return pts if pts else None

    except Exception as e:
        if dbg is not None:
            dbg.append(f"  → FIT exception: {e}")
        logger.warning(f"Could not fetch/parse FIT for {activity_id}: {e}")
        return None


def _dbg_gps(streams: dict, dbg: list):
    """Append detailed GPS-availability summary to dbg list."""
    latlng  = streams.get("latlng")
    lat     = streams.get("lat")
    lon     = streams.get("lon")
    time_s  = streams.get("time")
    alt_s   = streams.get("altitude")

    # Reference: time and altitude lengths help us understand latlng's structure
    if time_s is not None:
        dbg.append(f"  → time stream: len={len(time_s)}, first 3: {time_s[:3]}")
    if alt_s is not None:
        dbg.append(f"  → altitude stream: len={len(alt_s)}, first 3: {alt_s[:3]}")

    if latlng:
        first = next((v for v in latlng if v is not None), None)
        fmt = "flat-scalars" if not isinstance(first, (list, tuple)) else "pairs"
        dbg.append(f"  → latlng: len={len(latlng)}, element type={fmt}")
        dbg.append(f"  → raw[0:20]: {latlng[:20]}")

        if time_s is not None:
            ratio = len(latlng) / len(time_s) if time_s else "?"
            dbg.append(f"  → len(latlng)/len(time) = {len(latlng)}/{len(time_s)} = {ratio:.2f}")
            if abs(ratio - 1.0) < 0.05:
                dbg.append(f"  → CONCLUSION: latlng has ONE value per time step → likely lat-only stream")
            elif abs(ratio - 2.0) < 0.05:
                dbg.append(f"  → CONCLUSION: latlng has TWO values per time step → flat [lat,lon,lat,lon,...] pairs")
            else:
                dbg.append(f"  → CONCLUSION: unexpected ratio, unclear format")

        if fmt == "flat-scalars":
            pairs = list(zip(latlng[0::2], latlng[1::2]))[:3]
            dbg.append(f"  → if treated as flat pairs (even=lat, odd=lon): {pairs}")
    lng = streams.get("lng")
    if lng:
        dbg.append(f"  → lng (data2): len={len(lng)}, first={lng[0]} ✓")
    if lat and lon:
        dbg.append(f"  → separate lat/lon keys: len={len(lat)}, first lat={lat[0]}, first lon={lon[0]}")
    if not latlng and not (lat and lon):
        dbg.append(f"  → NO GPS keys found in streams")
        dbg.append(f"  → all stream keys: {list(streams.keys())}")


def build_track_points(streams: dict) -> Optional[list]:
    """Convert normalised streams dict to our [{lat,lon,ele,time,hr,cad}] format.
    Returns None if GPS data is absent or clearly lat-only."""
    if not streams:
        return None

    latlng  = streams.get("latlng")   # latitude values (data)
    lng_s   = streams.get("lng")       # longitude values (data2, extracted by normaliser)
    time_s  = streams.get("time")
    lats = lons = None

    if latlng and lng_s:
        # Best case: separate lat (latlng/data) and lon (lng/data2) arrays
        lats = latlng
        lons = lng_s
    elif latlng and isinstance(latlng, list):
        first = next((v for v in latlng if v is not None), None)
        if isinstance(first, (list, tuple)):
            # Paired format: [[lat, lon], ...]
            try:
                lats = [p[0] for p in latlng]
                lons = [p[1] for p in latlng]
            except (IndexError, TypeError) as e:
                logger.warning(f"Failed to unpack latlng pairs: {e}")
        elif time_s and len(latlng) == len(time_s):
            # One scalar per time step → lat-only, no longitude available
            logger.debug("latlng stream is lat-only (len == len(time)), skipping")
            return None
        else:
            # Flat alternating format: [lat, lon, lat, lon, ...]
            lats = latlng[0::2]
            lons = latlng[1::2]

    # Fallback: separate lat/lon keys
    if not lats:
        lats = streams.get("lat")
    if not lons:
        lons = streams.get("lon")

    if not lats or not lons:
        return None

    eles    = streams.get("altitude")
    times   = streams.get("time")                                      # seconds offset from start
    hrs     = streams.get("heartrate")
    cads    = streams.get("cadence")
    speeds  = streams.get("velocity_smooth") or streams.get("speed")  # m/s
    powers  = streams.get("watts") or streams.get("power")            # W
    vos     = streams.get("vertical_oscillation")                     # cm
    gcts    = streams.get("ground_contact_time")                      # ms
    strides = streams.get("stride_length")                            # cm

    n = min(len(lats), len(lons))
    pts: list = []
    for i in range(n):
        lat = lats[i]
        lon = lons[i]
        if lat is None or lon is None:
            continue
        # Skip 0,0 points (GPS not yet acquired)
        if abs(lat) < 0.001 and abs(lon) < 0.001:
            continue
        pts.append({
            "lat":                lat,
            "lon":                lon,
            "ele":                eles[i]    if eles    and i < len(eles)    else None,
            "time":               times[i]   if times   and i < len(times)   else None,
            "hr":                 hrs[i]     if hrs     and i < len(hrs)     else None,
            "cad":                cads[i]    if cads    and i < len(cads)    else None,
            "speed":              speeds[i]  if speeds  and i < len(speeds)  else None,  # m/s
            "power":              powers[i]  if powers  and i < len(powers)  else None,  # W
            "vertical_oscillation": vos[i]  if vos     and i < len(vos)     else None,  # cm
            "ground_contact_time":  gcts[i] if gcts    and i < len(gcts)    else None,  # ms
            "stride_length":      strides[i] if strides and i < len(strides) else None,  # cm
        })
    return pts if pts else None


def extract_metrics(act: dict) -> dict:
    """Pull intervals.icu pre-computed metrics from a raw activity dict."""
    return {
        "icu_training_load":    _f(act.get("icu_training_load")),
        "icu_atl":              _f(act.get("icu_atl")),
        "icu_ctl":              _f(act.get("icu_ctl")),
        "trimp":                _f(act.get("trimp")),
        "icu_hr_zone_times":    act.get("icu_hr_zone_times"),
        "icu_zone_times":       act.get("icu_zone_times"),
        "perceived_exertion":   _i(act.get("perceived_exertion")),
        "icu_intensity":        _f(act.get("icu_intensity")),
        "icu_efficiency_factor":_f(act.get("icu_efficiency_factor")),
        "icu_decoupling":       _f(act.get("icu_decoupling")),
    }


def activity_to_workout_data(act: dict, streams: Optional[dict],
                             api_key: str = "", dbg: Optional[list] = None) -> dict:
    """Convert a raw intervals.icu activity + streams to our internal workout dict."""
    sport = _map_sport(act.get("type") or act.get("sport_type") or "")

    started_at = _parse_dt(act.get("start_date_local") or act.get("start_date"))
    if not started_at:
        started_at = datetime.now(timezone.utc)

    distance    = act.get("distance")            # meters
    duration    = act.get("elapsed_time") or act.get("elapsed_time_raw")
    moving_time = act.get("moving_time")
    elev_gain   = act.get("total_elevation_gain") or act.get("elevation_gain")
    elev_loss   = act.get("elevation_loss")
    avg_hr      = act.get("average_heartrate")
    max_hr      = act.get("max_heartrate")
    avg_speed   = act.get("average_speed")       # m/s
    max_speed   = act.get("max_speed")
    avg_cad     = act.get("average_cadence")
    avg_power   = act.get("average_watts")
    calories    = act.get("calories") or act.get("kilojoules")

    title = act.get("name") or f"{sport.replace('_',' ').title()} – {started_at.strftime('%b %d, %Y')}"

    # Primary: build track from streams (returns None if latlng is lat-only)
    track_points = build_track_points(streams) if streams else None
    if dbg is not None:
        if track_points:
            dbg.append(f"  → track from streams: {len(track_points)} pts ✓")
        else:
            dbg.append(f"  → no track from streams")

    # Fallback 1: download and parse the original FIT file
    if not track_points and api_key:
        act_id = str(act.get("id", ""))
        if act_id:
            track_points = fetch_fit_gps(api_key, act_id, dbg=dbg)

    # Fallback 2: decode the summary polyline embedded in the activity object
    if not track_points:
        polyline = None
        map_field = act.get("map") or {}
        if isinstance(map_field, dict):
            polyline = map_field.get("polyline") or map_field.get("summary_polyline")
        if not polyline:
            polyline = act.get("polyline") or act.get("summary_polyline")
        if dbg is not None:
            dbg.append(f"  → polyline field present: {bool(polyline)}" +
                       (f" (len={len(polyline)})" if polyline else ""))
        if polyline:
            decoded = _decode_polyline(polyline)
            if decoded:
                track_points = [{"lat": p[0], "lon": p[1], "ele": None, "time": None, "hr": None, "cad": None}
                                for p in decoded]
                if dbg is not None:
                    dbg.append(f"  → track from polyline fallback: {len(track_points)} pts ✓")
            elif dbg is not None:
                dbg.append(f"  → polyline decode yielded 0 pts")

    # Bounding box
    bbox_min_lat = bbox_max_lat = bbox_min_lon = bbox_max_lon = None
    if track_points:
        lats = [p["lat"] for p in track_points]
        lons = [p["lon"] for p in track_points]
        bbox_min_lat, bbox_max_lat = min(lats), max(lats)
        bbox_min_lon, bbox_max_lon = min(lons), max(lons)

    return {
        "title":                 title,
        "sport":                 sport,
        "started_at":            started_at,
        "duration_seconds":      _i(duration),
        "moving_time_seconds":   _i(moving_time),
        "distance_meters":       _f(distance),
        "elevation_gain_meters": _f(elev_gain),
        "elevation_loss_meters": _f(elev_loss),
        "avg_heart_rate":        _i(avg_hr),
        "max_heart_rate":        _i(max_hr),
        "avg_speed_ms":          _f(avg_speed),
        "max_speed_ms":          _f(max_speed),
        "avg_cadence":           _i(avg_cad),
        "avg_power_watts":       _i(avg_power),
        "calories":              _i(calories),
        "track_points":          track_points,
        "bbox_min_lat":          bbox_min_lat,
        "bbox_max_lat":          bbox_max_lat,
        "bbox_min_lon":          bbox_min_lon,
        "bbox_max_lon":          bbox_max_lon,
        "source":                "intervals_icu",
        "garmin_activity_id":    None,
        "original_filename":     None,
        "metrics":               extract_metrics(act),
    }
