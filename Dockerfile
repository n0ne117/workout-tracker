# All-in-one image: nginx serves the built SPA and proxies /api to uvicorn on
# loopback. One container, one port, one volume — which is what Unraid and most
# other single-container hosts expect.
#
# The two-service docker-compose.yml still builds backend/ and frontend/
# separately for development; this image is what gets published.

# ── Stage 1: build the frontend ──────────────────────────────────────────────
FROM node:20-alpine AS frontend

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
# `npm ci` needs the lockfile and installs exactly what it pins.
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# ── Stage 2: python deps ─────────────────────────────────────────────────────
FROM python:3.12-slim AS deps

RUN apt-get update \
 && apt-get install -y --no-install-recommends gcc \
 && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM python:3.12-slim

LABEL org.opencontainers.image.title="Workout Tracker" \
      org.opencontainers.image.description="Self-hosted training log with Intervals.icu, Garmin and FIT/GPX import" \
      org.opencontainers.image.source="https://github.com/n0ne117/workout-tracker"

# nginx only; gcc was needed to build wheels, not to run them.
RUN apt-get update \
 && apt-get install -y --no-install-recommends nginx \
 && rm -rf /var/lib/apt/lists/* \
 && rm -f /etc/nginx/sites-enabled/default

COPY --from=deps /install /usr/local
COPY --from=frontend /build/dist /app/static

WORKDIR /app
COPY backend/ /app/
COPY docker/nginx.conf /etc/nginx/conf.d/workout-tracker.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# SQLite database lives here; mount it or the data disappears with the container.
VOLUME ["/data"]
ENV PYTHONUNBUFFERED=1 \
    DATA_DIR=/data

EXPOSE 80

# Checks through nginx, so a healthy result means both processes are serving.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1/api/health',timeout=4).status==200 else 1)"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
