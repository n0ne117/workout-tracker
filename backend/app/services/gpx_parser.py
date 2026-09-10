import gpxpy
import gpxpy.gpx
from datetime import datetime, timezone
from typing import Optional
import math


def parse_gpx(content: bytes) -> dict:
    """Parse a GPX file and return workout data."""
    gpx = gpxpy.parse(content.decode("utf-8"))

    track_points = []
    total_distance = 0.0
    elevation_gain = 0.0
    elevation_loss = 0.0
    min_lat = min_lon = float("inf")
    max_lat = max_lon = float("-inf")
    heart_rates = []
    cadences = []

    prev_point = None
    started_at = None
    ended_at = None

    for track in gpx.tracks:
        for segment in track.segments:
            for point in segment.points:
                lat = point.latitude
                lon = point.longitude
                ele = point.elevation
                t = point.time

                if t and started_at is None:
                    started_at = t
                if t:
                    ended_at = t

                # Bounding box
                min_lat = min(min_lat, lat)
                max_lat = max(max_lat, lat)
                min_lon = min(min_lon, lon)
                max_lon = max(max_lon, lon)

                # Distance & elevation
                if prev_point:
                    d = _haversine(
                        prev_point["lat"], prev_point["lon"], lat, lon
                    )
                    total_distance += d
                    if ele is not None and prev_point["ele"] is not None:
                        diff = ele - prev_point["ele"]
                        if diff > 0:
                            elevation_gain += diff
                        else:
                            elevation_loss += abs(diff)

                # Extensions (HR, cadence)
                hr = None
                cad = None
                if point.extensions:
                    for ext in point.extensions:
                        for child in ext:
                            tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
                            if tag in ("hr", "heartrate", "heart_rate"):
                                try:
                                    hr = int(child.text)
                                    heart_rates.append(hr)
                                except (ValueError, TypeError):
                                    pass
                            elif tag in ("cad", "cadence"):
                                try:
                                    cad = int(child.text)
                                    cadences.append(cad)
                                except (ValueError, TypeError):
                                    pass

                pt = {
                    "lat": lat,
                    "lon": lon,
                    "ele": ele,
                    "time": t.isoformat() if t else None,
                    "hr": hr,
                    "cad": cad,
                }
                track_points.append(pt)
                prev_point = pt

    # Waypoints (for activities without tracks)
    if not track_points:
        for wp in gpx.waypoints:
            pt = {
                "lat": wp.latitude,
                "lon": wp.longitude,
                "ele": wp.elevation,
                "time": wp.time.isoformat() if wp.time else None,
                "hr": None,
                "cad": None,
            }
            track_points.append(pt)

    duration_seconds = None
    if started_at and ended_at and started_at != ended_at:
        duration_seconds = int((ended_at - started_at).total_seconds())

    avg_hr = int(sum(heart_rates) / len(heart_rates)) if heart_rates else None
    max_hr = max(heart_rates) if heart_rates else None

    title = gpx.name or (gpx.tracks[0].name if gpx.tracks else None) or "GPX Import"

    result = {
        "title": title,
        "started_at": started_at or datetime.now(timezone.utc),
        "duration_seconds": duration_seconds,
        "distance_meters": total_distance if total_distance > 0 else None,
        "elevation_gain_meters": elevation_gain if elevation_gain > 0 else None,
        "elevation_loss_meters": elevation_loss if elevation_loss > 0 else None,
        "avg_heart_rate": avg_hr,
        "max_heart_rate": max_hr,
        "track_points": track_points if track_points else None,
        "bbox_min_lat": min_lat if min_lat != float("inf") else None,
        "bbox_max_lat": max_lat if max_lat != float("-inf") else None,
        "bbox_min_lon": min_lon if min_lon != float("inf") else None,
        "bbox_max_lon": max_lon if max_lon != float("-inf") else None,
    }
    return result


def _haversine(lat1, lon1, lat2, lon2) -> float:
    """Return distance in meters between two lat/lon points."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
