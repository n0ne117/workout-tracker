"""Start times are stored as local wall-clock time, whatever the source."""
from datetime import datetime, timedelta, timezone

from app.database import FILE_TIMES_LOCAL, _convert_file_times
from app.services.intervals_service import activity_to_workout_data
from app.services.kml_parser import parse_kml
from app.services.tcx_parser import parse_tcx
from app.services.timeutil import to_local

GPX = """<?xml version="1.0"?><gpx version="1.1" creator="t" xmlns="http://www.topografix.com/GPX/1/1">
<trk><name>Morning run</name><type>running</type><trkseg>
<trkpt lat="48.2" lon="16.37"><ele>170</ele><time>2026-07-01T05:00:00Z</time></trkpt>
<trkpt lat="48.201" lon="16.371"><ele>171</ele><time>2026-07-01T05:05:00Z</time></trkpt>
</trkseg></trk></gpx>"""

TCX = b"""<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
<Activities><Activity Sport="Running"><Id>2026-07-01T05:00:00Z</Id><Lap StartTime="2026-07-01T05:00:00Z">
<TotalTimeSeconds>600</TotalTimeSeconds><DistanceMeters>2000</DistanceMeters><Track><Trackpoint>
<Time>2026-07-01T05:00:00Z</Time><Position><LatitudeDegrees>48.2</LatitudeDegrees><LongitudeDegrees>16.3</LongitudeDegrees></Position>
</Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>"""

# Google Earth's layout: <when> in the KML namespace, <gx:coord> in gx.
KML = b"""<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
<Document><Placemark><gx:Track><when>2026-07-01T05:00:00Z</when><when>2026-07-01T05:10:00Z</when>
<gx:coord>16.3 48.2 170</gx:coord><gx:coord>16.31 48.21 171</gx:coord></gx:Track></Placemark></Document></kml>"""


def test_to_local_follows_dst_and_prefers_a_recorded_offset():
    assert to_local(datetime(2026, 1, 10, 6, tzinfo=timezone.utc)) == datetime(2026, 1, 10, 7)
    assert to_local(datetime(2026, 7, 10, 6, tzinfo=timezone.utc)) == datetime(2026, 7, 10, 8)
    assert to_local(datetime(2026, 7, 10, 6), timedelta(hours=-5)) == datetime(2026, 7, 10, 1)


def test_parsers_return_local_time():
    assert parse_tcx(TCX)["started_at"] == datetime(2026, 7, 1, 7)
    assert parse_kml(KML)["started_at"] == datetime(2026, 7, 1, 7)


def test_intervals_keeps_its_local_start_time():
    act = {"id": "1", "type": "Run", "start_date_local": "2026-07-01T07:00:00",
           "start_date": "2026-07-01T05:00:00Z"}
    assert activity_to_workout_data(act, None)["started_at"] == datetime(2026, 7, 1, 7)
    del act["start_date_local"]
    assert activity_to_workout_data(act, None)["started_at"] == datetime(2026, 7, 1, 7)


def test_gpx_upload_is_stored_local_and_a_second_copy_refused(client):
    upload = {"file": ("run.gpx", GPX, "application/gpx+xml")}
    first = client.post("/api/import/upload", files=upload)
    assert first.status_code == 200, first.text
    assert first.json()["started_at"] == "2026-07-01T07:00:00"
    assert client.post("/api/import/upload", files=upload).status_code == 409


def test_migration_converts_old_file_imports_once(client, raw_db):
    for title, source, at in [
        ("fit", "fit_file", "2026-07-01 05:00:00.000000"),
        ("gpx", "gpx_file", "2026-01-10 06:30:00.000000"),
        ("icu", "intervals_icu", "2026-07-01 07:00:00.000000"),
    ]:
        raw_db.execute("INSERT INTO workouts (title, sport, source, started_at, is_race)"
                       " VALUES (?, 'running', ?, ?, 0)", (title, source, at))
    raw_db.execute("PRAGMA user_version = 0")
    raw_db.commit()

    _convert_file_times()
    _convert_file_times()   # a second start must not shift them again

    rows = dict(raw_db.execute("SELECT title, started_at FROM workouts").fetchall())
    assert rows == {"fit": "2026-07-01 07:00:00.000000",
                    "gpx": "2026-01-10 07:30:00.000000",
                    "icu": "2026-07-01 07:00:00.000000"}
    assert raw_db.execute("PRAGMA user_version").fetchone()[0] == FILE_TIMES_LOCAL
