# Workout Tracker

Self-hosted training log. Imports from Intervals.icu, Garmin Connect and
FIT/GPX/TCX/KML files, then shows history, maps, charts, stats, gear wear,
races and training load. One container, responsive UI.

```yaml
services:
  workout-tracker:
    image: ghcr.io/n0ne117/workout-tracker:latest
    container_name: workout-tracker
    restart: unless-stopped
    ports:
      - "7733:80"
    volumes:
      - ./workout_data:/data
    environment:
      - TZ=Europe/Vienna
      # - PUID=99
      # - PGID=100
```

```bash
docker compose up -d
```

Then <http://localhost:7733>. The database lives in `./workout_data` — back
that up, ignore the rest. Have fun.
