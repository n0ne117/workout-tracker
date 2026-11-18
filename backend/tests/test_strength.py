"""Strength sessions: sets, volume, muscle split, exercises, templates."""
import io
import json
import zipfile

from app.models import StrengthSet

from conftest import add_workout


def _ex(client, name):
    return next(e for e in client.get("/api/strength/exercises").json() if e["name"] == name)


def _milon(client, rounds=1):
    lat, rue = _ex(client, "Latzug (Maschine)"), _ex(client, "Rückenstrecker (Maschine)")
    sets = []
    for r in range(1, rounds + 1):
        sets += [
            {"round": r, "position": 1, "set_no": 1, "exercise_id": lat["id"], "weight_kg": 37, "reps": 13},
            {"round": r, "position": 2, "set_no": 1, "exercise_id": rue["id"], "weight_kg": 36, "reps": 15},
        ]
    return sets


def test_catalog_is_german_and_uses_known_groups(client):
    exercises = client.get("/api/strength/exercises").json()
    groups = set(client.get("/api/strength/groups").json())
    assert len(exercises) >= 50
    assert {"Latzug (Maschine)", "Beinpresse (Maschine)", "Liegestütze"} <= {e["name"] for e in exercises}
    assert all(e["primary"] and set(e["primary"] + e["secondary"]) <= groups for e in exercises)


def test_session_volume_and_split(client):
    w = add_workout(client, title="Milon Zirkel", sport="strength_training")
    body = client.put(f"/api/workouts/{w['id']}/strength", json={"sets": _milon(client)}).json()
    s = body["summary"]
    assert s["volume"] == 37 * 13 + 36 * 15
    assert s["sets"] == 2 and s["reps"] == 28 and s["rounds"] == 1
    # Rücken counts fully twice; Arme (Latzug) and Core (Rückenstrecker) half each.
    split = {x["group"]: x["percent"] for x in s["split"]}
    assert split["Rücken"] == 67 and sorted([split["Arme"], split["Core"]]) == [16, 17]
    assert sum(split.values()) == 100
    assert s["split"][0]["group"] == "Rücken"


def test_rounds_and_replacing_a_session(client, db):
    w = add_workout(client, sport="strength_training")
    client.put(f"/api/workouts/{w['id']}/strength", json={"sets": _milon(client, rounds=3)})
    assert client.get(f"/api/workouts/{w['id']}/strength").json()["summary"]["rounds"] == 3
    client.put(f"/api/workouts/{w['id']}/strength", json={"sets": _milon(client, rounds=1)})
    assert db.query(StrengthSet).count() == 2


def test_unknown_exercise_is_refused(client):
    w = add_workout(client, sport="strength_training")
    bad = [{"round": 1, "position": 1, "set_no": 1, "exercise_id": 999999, "weight_kg": 10, "reps": 5}]
    assert client.put(f"/api/workouts/{w['id']}/strength", json={"sets": bad}).status_code == 422


def test_custom_exercise_rules(client):
    assert client.post("/api/strength/exercises", json={"name": "Nur Sekundär", "primary": []}).status_code == 422
    r = client.post("/api/strength/exercises",
                    json={"name": "Medizinball-Wurf", "primary": ["Core", "Nope"], "secondary": ["Core", "Schultern"]})
    ex = r.json()
    assert r.status_code == 201 and ex["primary"] == ["Core"] and ex["secondary"] == ["Schultern"]
    assert client.post("/api/strength/exercises", json={"name": "Medizinball-Wurf", "primary": ["Core"]}).status_code == 409

    w = add_workout(client, sport="strength_training")
    client.put(f"/api/workouts/{w['id']}/strength",
               json={"sets": [{"exercise_id": ex["id"], "weight_kg": 3, "reps": 12}]})
    assert client.delete(f"/api/strength/exercises/{ex['id']}").status_code == 409
    assert client.delete(f"/api/strength/exercises/{_ex(client, 'Crunches')['id']}").status_code == 400

    renamed = client.patch(f"/api/strength/exercises/{_ex(client, 'Crunches')['id']}",
                           json={"name": "Crunches (Matte)", "secondary": ["Beine"]}).json()
    assert renamed["name"] == "Crunches (Matte)" and renamed["primary"] == ["Core"] and renamed["secondary"] == ["Beine"]
    client.patch(f"/api/strength/exercises/{renamed['id']}", json={"name": "Crunches", "secondary": []})


def test_like_last_time_and_last_sets(client):
    old = add_workout(client, sport="strength_training", started_at="2026-10-01T18:00:00")
    new = add_workout(client, sport="strength_training", started_at="2026-10-08T18:00:00")
    client.put(f"/api/workouts/{old['id']}/strength", json={"sets": _milon(client)})

    prev = client.get(f"/api/workouts/{new['id']}/strength/previous").json()
    assert prev["workout"]["id"] == old["id"] and len(prev["sets"]) == 2
    assert client.get(f"/api/workouts/{old['id']}/strength/previous").json()["workout"] is None

    lat = _ex(client, "Latzug (Maschine)")["id"]
    last = client.get(f"/api/strength/exercises/last?ids={lat}&before=2026-10-08T18:00:00").json()
    assert last[str(lat)] == [{"round": 1, "set_no": 1, "weight_kg": 37, "reps": 13}]
    assert client.get(f"/api/strength/exercises/last?ids={lat}&before=2026-09-01T00:00:00").json() == {}


def test_templates_save_by_name(client):
    ids = [_ex(client, "Latzug (Maschine)")["id"], _ex(client, "Brustpresse (Maschine)")["id"]]
    client.post("/api/strength/templates", json={"name": "Milon Zirkel", "rounds": 2, "exercise_ids": ids})
    client.post("/api/strength/templates", json={"name": "Milon Zirkel", "rounds": 3, "exercise_ids": ids[::-1]})
    templates = client.get("/api/strength/templates").json()
    assert len(templates) == 1 and templates[0]["rounds"] == 3 and templates[0]["exercise_ids"] == ids[::-1]
    assert client.post("/api/strength/templates", json={"name": "X", "exercise_ids": [999999]}).status_code == 422
    assert client.delete(f"/api/strength/templates/{templates[0]['id']}").status_code == 200


def test_deleting_a_workout_deletes_its_sets(client, db):
    w = add_workout(client, sport="strength_training")
    client.put(f"/api/workouts/{w['id']}/strength", json={"sets": _milon(client)})
    client.delete(f"/api/workouts/{w['id']}")
    assert db.query(StrengthSet).count() == 0


def test_backup_round_trip_keeps_sets_custom_exercises_and_templates(client):
    w = add_workout(client, title="Milon", sport="strength_training")
    custom = client.post("/api/strength/exercises", json={"name": "Eigene Übung", "primary": ["Arme"]}).json()
    sets = _milon(client) + [{"round": 1, "position": 3, "set_no": 1, "exercise_id": custom["id"], "weight_kg": 10, "reps": 10}]
    client.put(f"/api/workouts/{w['id']}/strength", json={"sets": sets})
    client.post("/api/strength/templates", json={"name": "Milon Zirkel", "rounds": 2, "exercise_ids": [custom["id"]]})
    payload = client.get("/api/backup/full").content
    assert {"exercises.json", "strength_sets.json", "strength_templates.json"} <= set(zipfile.ZipFile(io.BytesIO(payload)).namelist())

    # Lose the custom exercise, then restore: it comes back and sets re-link.
    client.delete("/api/workouts?confirm=true")
    client.delete(f"/api/strength/exercises/{custom['id']}")
    r = client.post("/api/backup/restore", files={"file": ("b.zip", payload, "application/zip")}).json()
    assert r["stats"]["restored"]["strength_sets"] == 3 and r["stats"]["restored"]["strength_templates"] == 1

    restored = client.get("/api/workouts").json()["items"][0]
    summary = client.get(f"/api/workouts/{restored['id']}/strength").json()["summary"]
    assert summary["volume"] == 37 * 13 + 36 * 15 + 100
    assert "Eigene Übung" in {e["name"] for e in summary["exercises"]}
