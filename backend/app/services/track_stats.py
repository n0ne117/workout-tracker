import math
from datetime import datetime


def recalculate_track_stats(track_points: list) -> dict:
    """Recompute all derived metrics from a list of track-point dicts."""
    if not track_points:
        return {}

    total_distance = 0.0
    elevation_gain = 0.0
    elevation_loss = 0.0
    heart_rates = []
    min_lat = min_lon = float("inf")
    max_lat = max_lon = float("-inf")
    started_at = None
    ended_at = None
    prev = None

    for pt in track_points:
        lat = pt.get("lat")
        lon = pt.get("lon")
        if lat is None or lon is None:
            continue

        ele = pt.get("ele")
        t_str = pt.get("time")
        if t_str:
            try:
                t_dt = datetime.fromisoformat(t_str.replace("Z", "+00:00"))
                if started_at is None:
                    started_at = t_dt
                ended_at = t_dt
            except Exception:
                pass

        min_lat = min(min_lat, lat)
        max_lat = max(max_lat, lat)
        min_lon = min(min_lon, lon)
        max_lon = max(max_lon, lon)

        if prev is not None:
            d = _haversine(prev["lat"], prev["lon"], lat, lon)
            total_distance += d
            prev_ele = prev.get("ele")
            if ele is not None and prev_ele is not None:
                diff = ele - prev_ele
                if diff > 0:
                    elevation_gain += diff
                else:
                    elevation_loss += abs(diff)

        hr = pt.get("hr")
        if hr:
            heart_rates.append(hr)

        prev = {"lat": lat, "lon": lon, "ele": ele}

    duration_seconds = None
    if started_at and ended_at and started_at != ended_at:
        duration_seconds = int((ended_at - started_at).total_seconds())

    return {
        "started_at": started_at,
        "duration_seconds": duration_seconds,
        "distance_meters": total_distance if total_distance > 0 else None,
        "elevation_gain_meters": elevation_gain if elevation_gain > 0 else None,
        "elevation_loss_meters": elevation_loss if elevation_loss > 0 else None,
        "avg_heart_rate": int(sum(heart_rates) / len(heart_rates)) if heart_rates else None,
        "max_heart_rate": max(heart_rates) if heart_rates else None,
        "bbox_min_lat": min_lat if min_lat != float("inf") else None,
        "bbox_max_lat": max_lat if max_lat != float("-inf") else None,
        "bbox_min_lon": min_lon if min_lon != float("inf") else None,
        "bbox_max_lon": max_lon if max_lon != float("-inf") else None,
    }


def _haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
