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

## Install

### Unraid

The published image is a single container: one port, one volume.

1. **Docker → Add Container**, switch to *Advanced view*
2. **Repository**: `ghcr.io/n0ne117/workout-tracker:latest`
3. **Port**: container `80` → host `7733`
4. **Path**: container `/data` → host `/mnt/cache/appdata/workout-tracker`
5. Optionally set **PUID** `99` and **PGID** `100` so files aren't root-owned

Or drop [`unraid/workout-tracker.xml`](unraid/workout-tracker.xml) into
`/boot/config/plugins/dockerMan/templates-user/` on the host and pick
*workout-tracker* from the template dropdown.

> **Put the data on cache, not `/mnt/user`.** The database is SQLite, and
> SQLite over Unraid's FUSE layer can hit file-locking problems. Either point
> the path at `/mnt/cache/...` or set the appdata share to cache-only.

While the GHCR package is private, authenticate the host once with a
[classic PAT](https://github.com/settings/tokens) carrying `read:packages`:

```bash
docker login ghcr.io -u n0ne117
```

Making the package public on its
[GHCR page](https://github.com/n0ne117/workout-tracker/pkgs/container/workout-tracker)
removes that step — package visibility is separate from repository visibility,
so a public image does not expose the source.

### Any other Docker host

```bash
docker run -d --name workout-tracker \
  -p 7733:80 \
  -v /srv/workout-tracker:/data \
  --restart unless-stopped \
  ghcr.io/n0ne117/workout-tracker:latest
```

| Variable       | Default            | Purpose                                              |
| -------------- | ------------------ | ---------------------------------------------------- |
| `PUID`/`PGID`  | unset (runs as root) | Drop the API process to this user/group            |
| `DATA_DIR`     | `/data`            | Where the SQLite database lives                      |
| `DATABASE_URL` | derived from `DATA_DIR` | Full SQLAlchemy URL, overriding `DATA_DIR`      |
| `TZ`           | `UTC`              | Container timezone; affects log timestamps only      |

Upgrades are `docker pull` plus a recreate — schema migrations are additive
and run automatically at startup.

## Building from source

```bash
docker compose up -d --build
```

This uses the two-service `docker-compose.yml` (separate backend and nginx
containers) and is the development setup. Then open <http://localhost:7733>.

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
