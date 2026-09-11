#!/usr/bin/env bash
#
# Runs uvicorn and nginx in one container and ties their lifetimes together:
# if either dies, the container exits so Docker's restart policy takes over.
# Without that, a crashed backend would leave nginx happily serving 502s.
#
# PUID/PGID follow the Unraid convention. When set, the API process drops to
# that user so files on the array aren't left owned by root. nginx's master
# stays root because it binds port 80 (its workers drop to www-data on their
# own). When unset, everything runs as root, which keeps a plain
# `docker run -v ./data:/data` behaving exactly like the compose setup.
set -euo pipefail

DATA_DIR="${DATA_DIR:-/data}"

mkdir -p "$DATA_DIR"

run_api=(uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level warning)

if [[ -n "${PUID:-}" || -n "${PGID:-}" ]]; then
  puid="${PUID:-99}"
  pgid="${PGID:-100}"
  echo "[init] running API as ${puid}:${pgid}"
  chown -R "${puid}:${pgid}" "$DATA_DIR" 2>/dev/null || \
    echo "[init] warning: could not chown ${DATA_DIR}; continuing"
  run_api=(setpriv --reuid "$puid" --regid "$pgid" --clear-groups "${run_api[@]}")
else
  echo "[init] running as root (set PUID/PGID to drop privileges)"
fi

"${run_api[@]}" &
api_pid=$!

nginx -g 'daemon off;' &
nginx_pid=$!

shutdown() {
  trap - TERM INT
  kill -TERM "$api_pid" "$nginx_pid" 2>/dev/null || true
  wait "$api_pid" "$nginx_pid" 2>/dev/null || true
  exit 0
}
trap shutdown TERM INT

# Wake as soon as either process exits, then take the whole container down.
# `|| true` because a signal-killed child makes wait return non-zero, and
# set -e would abort here before the diagnostic below could run.
wait -n "$api_pid" "$nginx_pid" || true

if ! kill -0 "$api_pid" 2>/dev/null; then
  echo "[init] API process exited — stopping container" >&2
else
  echo "[init] nginx exited — stopping container" >&2
fi

kill -TERM "$api_pid" "$nginx_pid" 2>/dev/null || true
wait 2>/dev/null || true
exit 1
