import io
import math
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Optional

KML_NS  = "http://www.opengis.net/kml/2.2"
KML_NS2 = "http://earth.google.com/kml/2.2"
GX_NS   = "http://www.google.com/kml/ext/2.2"


def _ns(tag, ns=KML_NS):
    return f"{{{ns}}}{tag}"


def _haversine_m(lat1, lon1, lat2, lon2):
    R = 6_371_000
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _parse_coord(text: str):
    """lon,lat[,ele] → (lat, lon, ele|None)"""
    parts = text.strip().split(",")
    if len(parts) < 2:
        return None
    lon, lat = float(parts[0]), float(parts[1])
    ele = float(parts[2]) if len(parts) >= 3 else None
    return lat, lon, ele


def _build_result(name: str, points: list) -> dict:
    """
    points: list of (lat, lon, ele|None, dt|None)
    """
    if not points:
        raise ValueError("No track points found")

    track_pts = []
    dist = 0.0
    prev = None
    elevations = []
    times = []

    for lat, lon, ele, dt in points:
        if prev:
            dist += _haversine_m(prev[0], prev[1], lat, lon)
        tp = {"lat": lat, "lon": lon}
        if ele is not None:
            tp["ele"] = round(ele, 1)
            elevations.append(ele)
        if dt is not None:
            tp["time"] = dt.isoformat()
            times.append(dt)
        track_pts.append(tp)
        prev = (lat, lon)

    started_at = times[0] if times else datetime.now(timezone.utc)
    duration = int((times[-1] - times[0]).total_seconds()) if len(times) >= 2 else None

    # Elevation gain/loss
    ele_gain = ele_loss = None
    if len(elevations) >= 2:
        gain = loss = 0.0
        for i in range(1, len(elevations)):
            diff = elevations[i] - elevations[i - 1]
            if diff > 0:
                gain += diff
            else:
                loss += abs(diff)
        ele_gain, ele_loss = round(gain, 1), round(loss, 1)

    # Bounding box
    lats = [p[0] for p in points]
    lons = [p[1] for p in points]

    return {
        "title": name or "KML Activity",
        "sport": "other",
        "started_at": started_at,
        "distance_meters": round(dist, 2) if dist > 0 else None,
        "duration_seconds": duration,
        "elevation_gain_meters": ele_gain,
        "elevation_loss_meters": ele_loss,
        "track_points": track_pts,
        "bbox_min_lat": min(lats),
        "bbox_max_lat": max(lats),
        "bbox_min_lon": min(lons),
        "bbox_max_lon": max(lons),
    }


def _extract_name(root) -> str:
    for ns in (KML_NS, KML_NS2, ""):
        prefix = f"{{{ns}}}" if ns else ""
        for el in root.iter(f"{prefix}name"):
            if el.text and el.text.strip():
                return el.text.strip()
    return ""


def _parse_gx_track(root) -> list:
    """Parse gx:Track elements (Garmin-extended KML with timestamps)."""
    points = []
    for track in root.iter(f"{{{GX_NS}}}Track"):
        whens = [el.text for el in track.findall(f"{{{GX_NS}}}when") or track.findall("when")]
        coords = [el.text for el in track.findall(f"{{{GX_NS}}}coord")]
        for w, c in zip(whens, coords):
            try:
                dt = datetime.fromisoformat(w.replace("Z", "+00:00")) if w else None
                parts = c.strip().split()  # gx:coord is "lon lat ele"
                if len(parts) >= 2:
                    lon, lat = float(parts[0]), float(parts[1])
                    ele = float(parts[2]) if len(parts) >= 3 else None
                    points.append((lat, lon, ele, dt))
            except (ValueError, AttributeError):
                continue
    return points


def _parse_linestring(root) -> list:
    """Parse LineString coordinates (no timestamps)."""
    points = []
    for ns in (KML_NS, KML_NS2, ""):
        prefix = f"{{{ns}}}" if ns else ""
        for coords_el in root.iter(f"{prefix}coordinates"):
            if not coords_el.text:
                continue
            for token in coords_el.text.strip().split():
                parsed = _parse_coord(token)
                if parsed:
                    lat, lon, ele = parsed
                    points.append((lat, lon, ele, None))
            if points:
                return points
    return points


def parse_kml(content: bytes) -> dict:
    try:
        root = ET.fromstring(content.decode("utf-8", errors="replace"))
    except ET.ParseError as e:
        raise ValueError(f"Invalid KML XML: {e}")

    name = _extract_name(root)

    # Try gx:Track first (has timestamps)
    points = _parse_gx_track(root)

    # Fall back to LineString
    if not points:
        points = _parse_linestring(root)

    if not points:
        raise ValueError("No track coordinates found in KML file")

    return _build_result(name, points)


def parse_kmz(content: bytes) -> dict:
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            # Find the primary KML file (usually doc.kml)
            kml_names = [n for n in zf.namelist() if n.lower().endswith(".kml")]
            if not kml_names:
                raise ValueError("No .kml file found inside KMZ archive")
            # prefer doc.kml, otherwise first match
            primary = next((n for n in kml_names if n.lower() == "doc.kml"), kml_names[0])
            kml_bytes = zf.read(primary)
    except zipfile.BadZipFile:
        raise ValueError("Invalid KMZ file (not a valid ZIP archive)")
    return parse_kml(kml_bytes)
