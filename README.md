# Workout Tracker

A self-hosted training log. Imports activities from Intervals.icu, Garmin
Connect and raw GPS files, then gives you the views those services don't:
long-run history, gear wear, virtual challenges, and a training-load lab.

Runs as two containers behind nginx. Your data stays on your machine.

## Features

- **Import** — Intervals.icu sync, Garmin Connect, and `.fit` / `.gpx` /
  `.tcx` / `.kml` / `.kmz` uploads
- **Workouts** — collapsible year/month history, filters, full-text search
- **Detail view** — Leaflet route map, heart-rate, pace, elevation,
  cadence, power and walk/run charts, GPS track trimming
- **Statistics** — current week/month/year, all-time totals, year
  comparison, activity heatmap, monthly volume, per-sport personal records
- **Gear** — distance and moving-hours tracking per item, with wear limits
- **Races** — race history plus a forward-looking race calendar
- **Conqueror** — virtual challenge progress and cost tracking
- **RunLab** — CTL/ATL/TSB curves, intensity distribution, race predictions

The interface is responsive: one implementation of every screen, with a
bottom tab bar on phones and a full header nav from `md` up.

## Running it

```bash
docker compose up -d --build
```

Then open <http://localhost:7733>.

The SQLite database lives in `workout_data/`, mounted into the backend at
`/data`. That directory is git-ignored and holds your entire activity
history, GPS tracks, and your Intervals.icu API key — keep it out of any
repository.

To import from Intervals.icu, add your API key and athlete ID under
**Settings → Intervals.icu**, then press **Sync**.

### Optional: seed virtual challenges

On a fresh database the backend looks for `workout_data/challenges_seed.json`
and imports it if present. Absent, seeding is skipped and challenges can be
added through the UI.

```json
[
  {
    "name": "Example Trail",
    "distance_km": 100,
    "purchase_date": "2025-01-15",
    "cost_eur": 29.99,
    "start_date": "2025-02-01",
    "end_date": "2025-04-30",
    "year": 2025
  }
]
```

`use_before` and `notes` are also accepted; every date field is optional.

## Development

```bash
cd frontend && npm install && npm run dev   # Vite dev server
```

The backend image bakes the source in with `COPY . .`, so backend changes
need `docker compose up -d --build backend` — a plain `restart` will keep
running the old code.

## Layout

```
backend/app
  routers/     one module per resource (workouts, gear, intervals, runlab, …)
  services/    file parsers and third-party clients
  models.py    SQLAlchemy schema; SPORT_CATEGORIES is the canonical sport list
  database.py  engine, session, and additive PRAGMA-checked migrations
frontend/src
  pages/       one component per route
  components/  shared UI, including all charts
  utils/
    sports.js  single source for sport labels, icons, colours and units
    format.js  all formatting; rates always derive from moving time
  hooks/
```

### Two conventions worth knowing

**Rates come from moving time.** Use `formatWorkoutRate(workout)` rather
than dividing distance by `duration_seconds`. Elapsed time counts every
pause as slow movement — one 8 km walk in a real database reads 54:59/km
elapsed against 11:21/km moving. The backend mirrors this in `_moving()`.

**Each sport carries its own unit.** `sports.js` marks every sport as
`pace` (min/km), `swim` (min/100m), `speed` (km/h) or `null` for sports
where distance means nothing. Read it from there instead of hardcoding
another `['running', 'trail_running', …]` list.

## Stack

FastAPI · SQLAlchemy · SQLite · React 18 · Vite · Tailwind · Leaflet ·
Recharts-free hand-rolled SVG charts
