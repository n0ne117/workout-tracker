import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Optional
import math

NS = {
    "tcx": "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2",
    "ax": "http://www.garmin.com/xmlschemas/ActivityExtension/v2",
}

SPORT_MAP = {
    "running": "running",
    "biking": "cycling",
    "swimming": "swimming",
    "hiking": "hiking",
    "walking": "walking",
    "other": "other",
    "multisport": "triathlon",
}


def _tag(el) -> str:
    """Strip namespace from tag."""
    return el.tag.split("}")[-1] if "}" in el.tag else el.tag


def _text(el, path: str) -> Optional[str]:
    found = el.find(path, NS)
    return found.text.strip() if found is not None and found.text else None


def _float(el, path: str) -> Optional[float]:
    v = _text(el, path)
    try:
        return float(v) if v else None
    except ValueError:
        return None


def _int(el, path: str) -> Optional[int]:
    v = _text(el, path)
    try:
        return int(float(v)) if v else None
    except ValueError:
        return None


def _parse_time(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def _haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def parse_tcx(content: bytes) -> dict:
    root = ET.fromstring(content)

    # Support both namespaced and bare TCX
    activities_el = root.find("tcx:Activities", NS) or root.find("Activities")
    if activities_el is None:
        raise ValueError("No <Activities> element found in TCX file")

    activity_el = (
        activities_el.find("tcx:Activity", NS)
        or activities_el.find("Activity")
    )
    if activity_el is None:
        raise ValueError("No <Activity> element found in TCX file")

    sport_raw = activity_el.attrib.get("Sport", "other").lower()
    sport = SPORT_MAP.get(sport_raw, "other")

    id_el = activity_el.find("tcx:Id", NS) or activity_el.find("Id")
    started_at = _parse_time(id_el.text.strip() if id_el is not None and id_el.text else None)

    # Aggregate across all laps
    total_time = 0.0
    total_distance = 0.0
    total_calories = 0
    elevation_gain = 0.0
    elevation_loss = 0.0
    hr_values = []
    max_hr = 0
    track_points = []
    min_lat = min_lon = float("inf")
    max_lat = max_lon = float("-inf")

    laps = activity_el.findall("tcx:Lap", NS) or activity_el.findall("Lap")

    for lap in laps:
        total_time += float(_text(lap, "tcx:TotalTimeSeconds") or _text(lap, "TotalTimeSeconds") or 0)
        dist = _text(lap, "tcx:DistanceMeters") or _text(lap, "DistanceMeters")
        if dist:
            total_distance += float(dist)
        cal = _text(lap, "tcx:Calories") or _text(lap, "Calories")
        if cal:
            total_calories += int(float(cal))

        avg_hr_el = (
            lap.find("tcx:AverageHeartRateBpm/tcx:Value", NS)
            or lap.find("AverageHeartRateBpm/Value")
        )
        if avg_hr_el is not None and avg_hr_el.text:
            hr_values.append(int(float(avg_hr_el.text)))

        max_hr_el = (
            lap.find("tcx:MaximumHeartRateBpm/tcx:Value", NS)
            or lap.find("MaximumHeartRateBpm/Value")
        )
        if max_hr_el is not None and max_hr_el.text:
            max_hr = max(max_hr, int(float(max_hr_el.text)))

        # Trackpoints
        tracks = lap.findall("tcx:Track", NS) or lap.findall("Track")
        prev = None
        for track in tracks:
            tps = track.findall("tcx:Trackpoint", NS) or track.findall("Trackpoint")
            for tp in tps:
                t_str = _text(tp, "tcx:Time") or _text(tp, "Time")
                t = _parse_time(t_str)

                pos = tp.find("tcx:Position", NS) or tp.find("Position")
                lat = lon = None
                if pos is not None:
                    lat_t = _text(pos, "tcx:LatitudeDegrees") or _text(pos, "LatitudeDegrees")
                    lon_t = _text(pos, "tcx:LongitudeDegrees") or _text(pos, "LongitudeDegrees")
                    if lat_t and lon_t:
                        lat = float(lat_t)
                        lon = float(lon_t)

                ele_t = _text(tp, "tcx:AltitudeMeters") or _text(tp, "AltitudeMeters")
                ele = float(ele_t) if ele_t else None

                hr_el = (
                    tp.find("tcx:HeartRateBpm/tcx:Value", NS)
                    or tp.find("HeartRateBpm/Value")
                )
                hr = int(float(hr_el.text)) if hr_el is not None and hr_el.text else None

                cad_el = tp.find("tcx:Cadence", NS) or tp.find("Cadence")
                cad = int(float(cad_el.text)) if cad_el is not None and cad_el.text else None

                # Speed from extensions
                speed = None
                ext = tp.find("tcx:Extensions", NS) or tp.find("Extensions")
                if ext is not None:
                    for child in ext.iter():
                        if _tag(child) in ("Speed", "speed"):
                            try:
                                speed = float(child.text)
                            except (TypeError, ValueError):
                                pass

                # Elevation diff
                if ele is not None and prev and prev.get("ele") is not None:
                    diff = ele - prev["ele"]
                    if diff > 0:
                        elevation_gain += diff
                    else:
                        elevation_loss += abs(diff)

                if lat is not None and lon is not None:
                    min_lat = min(min_lat, lat)
                    max_lat = max(max_lat, lat)
                    min_lon = min(min_lon, lon)
                    max_lon = max(max_lon, lon)

                pt = {"lat": lat, "lon": lon, "ele": ele,
                      "time": t.isoformat() if t else None, "hr": hr, "cad": cad}
                track_points.append(pt)
                prev = pt

    if not started_at and track_points:
        started_at = _parse_time(track_points[0].get("time"))

    # Filter out points without GPS
    gps_points = [p for p in track_points if p["lat"] is not None]

    avg_hr = int(sum(hr_values) / len(hr_values)) if hr_values else None

    title = f"{sport.replace('_', ' ').title()} Activity"
    if started_at:
        title = f"{sport.replace('_', ' ').title()} – {started_at.strftime('%b %d, %Y')}"

    return {
        "title": title,
        "sport": sport,
        "started_at": started_at or datetime.now(timezone.utc),
        "duration_seconds": int(total_time) if total_time else None,
        "distance_meters": total_distance if total_distance > 0 else None,
        "elevation_gain_meters": elevation_gain if elevation_gain > 0 else None,
        "elevation_loss_meters": elevation_loss if elevation_loss > 0 else None,
        "avg_heart_rate": avg_hr,
        "max_heart_rate": max_hr if max_hr > 0 else None,
        "calories": total_calories if total_calories > 0 else None,
        "track_points": gps_points if gps_points else None,
        "bbox_min_lat": min_lat if min_lat != float("inf") else None,
        "bbox_max_lat": max_lat if max_lat != float("-inf") else None,
        "bbox_min_lon": min_lon if min_lon != float("inf") else None,
        "bbox_max_lon": max_lon if max_lon != float("-inf") else None,
    }
