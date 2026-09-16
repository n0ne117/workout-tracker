# Workout Tracker

Self-hosted training log. Imports from Intervals.icu, Garmin Connect and
FIT/GPX/TCX/KML files, then shows history, maps, charts, stats, gear wear,
races and training load. One container, responsive UI.

```yaml
services:
  workout-tracker:
    image: ghcr.io/n0ne117/workout-tracker:${WORKOUTS_IMAGE_TAG:-latest}
    container_name: workout-tracker
    restart: unless-stopped
    ports:
      - "${WORKOUTS_PORT:-7733}:80"
    volumes:
      - ${WORKOUTS_DATA_HOST:-./workout_data}:/data:z
    environment:
      TZ: ${TZ:-UTC}
      PUID: ${PUID:-}
      PGID: ${PGID:-}
```

```bash
docker compose up -d
```

Then <http://localhost:7733>. The database lives in `./workout_data` — back
that up, ignore the rest.

Everything above has a default, so no configuration is required. To change a
port or move the data, copy `.env.example` to `.env` and edit that instead of
this file. Have fun.
