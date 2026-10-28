"""Indoor activities keep their heart rate, cadence and pace without GPS."""
from datetime import datetime

from app.models import AppSettings, Workout
from app.services import intervals_service

N = 30
INDOOR = {
    "time": list(range(N)),
    "heartrate": [110 + i for i in range(N)],
    "cadence": [80] * N,
    "velocity_smooth": [2.5] * N,
    "distance": [i * 2.5 for i in range(N)],
}
OUTDOOR = {**INDOOR, "latlng": [48.2 + i * 1e-4 for i in range(N)], "lng": [16.3] * N}


def test_streams_without_gps_become_points_without_coordinates():
    pts = intervals_service.build_track_points(INDOOR)
    assert len(pts) == N
    assert pts[5]["lat"] is None and pts[5]["hr"] == 115 and pts[5]["dist"] == 12.5


def test_gps_streams_still_carry_coordinates_and_distance():
    pts = intervals_service.build_track_points(OUTDOOR)
    assert pts[0]["lat"] == 48.2 and pts[0]["lon"] == 16.3 and pts[3]["dist"] == 7.5


def test_no_sensor_data_at_all_is_still_nothing():
    assert intervals_service.build_track_points({"time": list(range(N))}) is None


def test_import_keeps_indoor_streams_when_the_fit_has_no_gps(monkeypatch):
    monkeypatch.setattr(intervals_service, "fetch_fit_gps", lambda *a, **k: None)
    act = {"id": "i1", "type": "Run", "start_date_local": "2026-10-27T16:59:27"}
    data = intervals_service.activity_to_workout_data(act, INDOOR, api_key="key")
    assert len(data["track_points"]) == N
    assert data["bbox_min_lat"] is None


def _store(db, title, points, ext_id=None):
    w = Workout(title=title, sport="running", started_at=datetime(2026, 10, 27, 17),
                source="intervals_icu", garmin_activity_id=ext_id or f"icu_{title}", track_points=points)
    db.add(w)
    db.commit()
    return w.id


def test_has_track_means_gps(client, db):
    indoor = _store(db, "indoor", intervals_service.build_track_points(INDOOR))
    outdoor = _store(db, "outdoor", intervals_service.build_track_points(OUTDOOR))

    listed = {w["title"]: w["has_track"] for w in client.get("/api/workouts?date_from=2026-10-01").json()["items"]}
    assert listed == {"indoor": False, "outdoor": True}

    detail = client.get(f"/api/workouts/{indoor}").json()
    assert detail["has_track"] is False and len(detail["track_points"]) == N
    assert client.get(f"/api/workouts/{outdoor}").json()["has_track"] is True
    assert client.post(f"/api/workouts/{indoor}/trim", json={"start_index": 1, "end_index": 5}).status_code == 400


def test_backfill_fetches_streams_for_workouts_stored_without_any(client, db, monkeypatch):
    db.add(AppSettings(id=1, intervals_api_key="key"))
    db.commit()
    # Ids without the icu_ prefix: phase 1 (streams) takes any Intervals
    # workout, phase 2 (metrics) only icu_* ones — which would go online.
    treadmill = _store(db, "treadmill", None, ext_id="treadmill")
    nothing = _store(db, "nothing", None, ext_id="nothing")
    calls = []

    def fetch_streams(api_key, act_id, dbg=None):
        calls.append(act_id)
        return INDOOR if act_id == "treadmill" else None

    monkeypatch.setattr(intervals_service, "fetch_streams", fetch_streams)

    assert client.post("/api/intervals/backfill").status_code == 200
    db.expire_all()
    assert len(db.get(Workout, treadmill).track_points) == N
    assert db.get(Workout, nothing).track_points == []

    # Checked once is enough: the next run leaves both alone.
    calls.clear()
    client.post("/api/intervals/backfill")
    assert "treadmill" not in calls and "nothing" not in calls
