"""
Render a stored workout back out as GPX 1.1.

Exports carry these alongside the JSON so an archive is useful outside this
app — every GPS tool reads GPX, nothing else reads our schema. Heart rate and
cadence go in Garmin's TrackPointExtension, which is what Strava, Garmin
Connect and Intervals.icu all expect to find.
"""
from xml.sax.saxutils import escape

GPX_NS = "http://www.topografix.com/GPX/1/1"
TPX_NS = "http://www.garmin.com/xmlschemas/TrackPointExtension/v1"


def _point_xml(point: dict) -> str | None:
    lat, lon = point.get("lat"), point.get("lon")
    if lat is None or lon is None:
        return None

    bits = [f'      <trkpt lat="{lat}" lon="{lon}">']
    if point.get("ele") is not None:
        bits.append(f"        <ele>{point['ele']}</ele>")
    if point.get("iso_time"):
        bits.append(f"        <time>{escape(str(point['iso_time']))}</time>")

    hr, cad = point.get("hr"), point.get("cad")
    if hr is not None or cad is not None:
        bits.append("        <extensions>")
        bits.append(f'          <gpxtpx:TrackPointExtension xmlns:gpxtpx="{TPX_NS}">')
        if hr is not None:
            bits.append(f"            <gpxtpx:hr>{int(hr)}</gpxtpx:hr>")
        if cad is not None:
            bits.append(f"            <gpxtpx:cad>{int(cad)}</gpxtpx:cad>")
        bits.append("          </gpxtpx:TrackPointExtension>")
        bits.append("        </extensions>")

    bits.append("      </trkpt>")
    return "\n".join(bits)


def workout_to_gpx(workout) -> str | None:
    """GPX for a workout, or None when it has no usable coordinates."""
    points = workout.track_points
    if not points:
        return None

    start = workout.started_at

    # Stored points carry `time` as seconds from the start, not a timestamp.
    # Rebuilding absolute times is what makes the track usable elsewhere.
    prepared = []
    for point in points:
        if not isinstance(point, dict):
            continue
        offset = point.get("time")
        iso = None
        if start is not None and isinstance(offset, (int, float)):
            iso = (start.timestamp() + offset)
        prepared.append({**point, "iso_time": _iso(iso)})

    body = [xml for xml in (_point_xml(p) for p in prepared) if xml]
    if not body:
        return None

    name = escape(workout.title or f"Workout {workout.id}")
    sport = escape(workout.sport or "other")
    header = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<gpx version="1.1" creator="Workout Tracker" xmlns="{GPX_NS}">',
        "  <metadata>",
        f"    <name>{name}</name>",
    ]
    if start is not None:
        header.append(f"    <time>{_iso(start.timestamp())}</time>")
    header += [
        "  </metadata>",
        "  <trk>",
        f"    <name>{name}</name>",
        f"    <type>{sport}</type>",
        "    <trkseg>",
    ]
    footer = ["    </trkseg>", "  </trk>", "</gpx>", ""]
    return "\n".join(header + body + footer)


def _iso(epoch: float | None) -> str | None:
    if epoch is None:
        return None
    from datetime import datetime, timezone

    return datetime.fromtimestamp(epoch, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
