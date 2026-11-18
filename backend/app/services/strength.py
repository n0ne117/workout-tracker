"""
Strength training: the exercise catalog, and what a session adds up to.

Exercise names are German; everything else in the app stays English.
"""
from collections import defaultdict

from sqlalchemy.orm import Session

from app.models import Exercise

MUSCLE_GROUPS = ["Rücken", "Brust", "Schultern", "Arme", "Core", "Beine"]

# How much a set counts towards a group it only assists.
SECONDARY_WEIGHT = 0.5

# (key, name, primary groups, secondary groups)
CATALOG = [
    # ── Maschinen (Milon-Zirkel und Studio) ────────────────────────────────
    ("latzug-maschine",           "Latzug (Maschine)",              ["Rücken"],    ["Arme"]),
    ("rudern-maschine",           "Rudern (Maschine)",              ["Rücken"],    ["Arme", "Schultern"]),
    ("rueckenstrecker-maschine",  "Rückenstrecker (Maschine)",      ["Rücken"],    ["Core"]),
    ("brustpresse-maschine",      "Brustpresse (Maschine)",         ["Brust"],     ["Arme", "Schultern"]),
    ("butterfly-maschine",        "Butterfly (Maschine)",           ["Brust"],     ["Schultern"]),
    ("butterfly-reverse-maschine", "Butterfly Reverse (Maschine)",  ["Schultern"], ["Rücken"]),
    ("schulterpresse-maschine",   "Schulterpresse (Maschine)",      ["Schultern"], ["Arme"]),
    ("seitheben-maschine",        "Seitheben (Maschine)",           ["Schultern"], []),
    ("bizepscurl-maschine",       "Bizepscurl (Maschine)",          ["Arme"],      []),
    ("trizepsdruecken-maschine",  "Trizepsdrücken (Maschine)",      ["Arme"],      []),
    ("dips-maschine",             "Dips (Maschine)",                ["Arme"],      ["Brust", "Schultern"]),
    ("bauchtrainer-maschine",     "Bauchtrainer (Maschine)",        ["Core"],      []),
    ("rumpfrotation-maschine",    "Rumpfrotation (Maschine)",       ["Core"],      []),
    ("beinpresse-maschine",       "Beinpresse (Maschine)",          ["Beine"],     []),
    ("beinstrecker-maschine",     "Beinstrecker (Maschine)",        ["Beine"],     []),
    ("beinbeuger-maschine",       "Beinbeuger (Maschine)",          ["Beine"],     []),
    ("abduktor-maschine",         "Abduktor (Maschine)",            ["Beine"],     []),
    ("adduktor-maschine",         "Adduktor (Maschine)",            ["Beine"],     []),
    ("wadenheben-maschine",       "Wadenheben (Maschine)",          ["Beine"],     []),
    ("gesaesstrainer-maschine",   "Gesäßtrainer (Maschine)",        ["Beine"],     ["Core"]),
    ("kabelrudern-sitzend",       "Kabelrudern (sitzend)",          ["Rücken"],    ["Arme"]),
    ("face-pulls-kabel",          "Face Pulls (Kabel)",             ["Schultern"], ["Rücken"]),
    ("trizepsdruecken-kabel",     "Trizepsdrücken (Kabel)",         ["Arme"],      []),
    ("cable-crossover",           "Kabelzug-Crossover",             ["Brust"],     ["Schultern"]),
    # ── Freie Gewichte ──────────────────────────────────────────────────────
    ("bankdruecken-langhantel",   "Bankdrücken (Langhantel)",       ["Brust"],     ["Arme", "Schultern"]),
    ("schraegbankdruecken-kh",    "Schrägbankdrücken (Kurzhantel)", ["Brust"],     ["Schultern", "Arme"]),
    ("fliegende-kh",              "Fliegende (Kurzhantel)",         ["Brust"],     ["Schultern"]),
    ("kniebeuge-langhantel",      "Kniebeuge (Langhantel)",         ["Beine"],     ["Core"]),
    ("goblet-squat",              "Goblet Squat (Kurzhantel)",      ["Beine"],     ["Core"]),
    ("kreuzheben-langhantel",     "Kreuzheben (Langhantel)",        ["Beine", "Rücken"], ["Core"]),
    ("rumaenisches-kreuzheben",   "Rumänisches Kreuzheben",         ["Beine"],     ["Rücken"]),
    ("ausfallschritte-kh",        "Ausfallschritte (Kurzhantel)",   ["Beine"],     ["Core"]),
    ("bulgarische-kniebeuge",     "Bulgarische Kniebeuge",          ["Beine"],     []),
    ("schulterdruecken-kh",       "Schulterdrücken (Kurzhantel)",   ["Schultern"], ["Arme"]),
    ("seitheben-kh",              "Seitheben (Kurzhantel)",         ["Schultern"], []),
    ("rudern-vorgebeugt-lh",      "Vorgebeugtes Rudern (Langhantel)", ["Rücken"],  ["Arme"]),
    ("rudern-einarmig-kh",        "Einarmiges Rudern (Kurzhantel)", ["Rücken"],    ["Arme"]),
    ("bizepscurls-kh",            "Bizepscurls (Kurzhantel)",       ["Arme"],      []),
    ("hammercurls-kh",            "Hammercurls (Kurzhantel)",       ["Arme"],      []),
    ("trizeps-ueberkopf-kh",      "Trizepsdrücken über Kopf (Kurzhantel)", ["Arme"], []),
    ("kettlebell-swing",          "Kettlebell Swing",               ["Beine"],     ["Core", "Rücken"]),
    # ── Körpergewicht ───────────────────────────────────────────────────────
    ("liegestuetze",              "Liegestütze",                    ["Brust"],     ["Arme", "Schultern", "Core"]),
    ("klimmzuege",                "Klimmzüge",                      ["Rücken"],    ["Arme"]),
    ("dips-barren",               "Dips (Barren)",                  ["Arme"],      ["Brust", "Schultern"]),
    ("unterarmstuetz",            "Unterarmstütz (Plank)",          ["Core"],      ["Schultern"]),
    ("seitstuetz",                "Seitstütz",                      ["Core"],      []),
    ("crunches",                  "Crunches",                       ["Core"],      []),
    ("beinheben-haengend",        "Beinheben (hängend)",            ["Core"],      []),
    ("russian-twist",             "Russian Twist",                  ["Core"],      []),
    ("rueckenstrecken-bank",      "Rückenstrecken (Bank)",          ["Rücken"],    ["Beine"]),
    ("beckenheben",               "Beckenheben (Glute Bridge)",     ["Beine"],     ["Core"]),
    ("kniebeuge-koerpergewicht",  "Kniebeuge (Körpergewicht)",      ["Beine"],     []),
    ("wadenheben-stehend",        "Wadenheben (stehend)",           ["Beine"],     []),
    ("burpees",                   "Burpees",                        ["Beine"],     ["Brust", "Core"]),
    ("mountain-climbers",         "Mountain Climbers",              ["Core"],      ["Schultern"]),
    ("superman",                  "Superman",                       ["Rücken"],    []),
    ("bird-dog",                  "Bird Dog",                       ["Core"],      ["Rücken"]),
]


def seed_catalog(db: Session) -> int:
    """Add catalog exercises not yet in the database. Edits you made stay."""
    have = {k for (k,) in db.query(Exercise.key).filter(Exercise.key.isnot(None))}
    added = 0
    for key, name, primary, secondary in CATALOG:
        if key not in have:
            db.add(Exercise(key=key, name=name, primary=primary, secondary=secondary, custom=False))
            added += 1
    db.commit()
    return added


def valid_groups(groups) -> list:
    """Known muscle groups only, each once, in the canonical order."""
    wanted = set(groups or [])
    return [g for g in MUSCLE_GROUPS if g in wanted]


def _percentages(shares: dict) -> dict:
    """Whole percentages that always add up to exactly 100 (largest remainder)."""
    total = sum(shares.values())
    if not total:
        return {}
    exact = {g: v / total * 100 for g, v in shares.items()}
    floors = {g: int(v) for g, v in exact.items()}
    left = 100 - sum(floors.values())
    # Equal remainders (2/3 and 2/3 differ only in float noise) go to the
    # bigger share first, so 2 : ½ : ½ reads 67 / 17 / 16, not 66 / 17 / 17.
    by_remainder = sorted(exact, key=lambda g: (round(exact[g] - floors[g], 9), exact[g]), reverse=True)
    for g in by_remainder[:left]:
        floors[g] += 1
    return floors


def summarize(sets: list, exercises: dict) -> dict:
    """
    What a session adds up to.

    volume: Σ weight × reps (bodyweight sets count as 0 kg).
    split:  share of sets per muscle group — a set counts fully for each
            primary group and half for each secondary one — so heavy leg
            machines don't drown out arms the way a kilogram-based split would.
    """
    volume = 0.0
    reps = 0
    credit = defaultdict(float)
    per_exercise = {}
    for s in sets:
        ex = exercises.get(s["exercise_id"])
        if ex is None:
            continue
        w, r = s.get("weight_kg") or 0, s.get("reps") or 0
        volume += w * r
        reps += r
        for g in ex.primary or []:
            credit[g] += 1
        for g in ex.secondary or []:
            credit[g] += SECONDARY_WEIGHT
        e = per_exercise.setdefault(s["exercise_id"], {
            "exercise_id": s["exercise_id"], "name": ex.name,
            "sets": 0, "reps": 0, "volume": 0.0, "best_weight": None,
        })
        e["sets"] += 1
        e["reps"] += r
        e["volume"] += w * r
        if s.get("weight_kg") is not None:
            e["best_weight"] = max(e["best_weight"] or 0, s["weight_kg"])

    pct = _percentages(credit)
    split = sorted(
        ({"group": g, "percent": pct[g], "sets": round(credit[g], 1)} for g in pct),
        key=lambda x: (-x["percent"], MUSCLE_GROUPS.index(x["group"]) if x["group"] in MUSCLE_GROUPS else 99),
    )
    return {
        "sets": len(sets),
        "reps": reps,
        "volume": round(volume, 1),
        "rounds": max((s.get("round") or 1 for s in sets), default=0),
        "split": split,
        "exercises": [dict(e, volume=round(e["volume"], 1)) for e in per_exercise.values()],
    }
