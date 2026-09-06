#!/usr/bin/env bash
# Destructive restore of PostgreSQL and Garage from a backup.sh directory.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

DIR="${1:-}"
if [[ -z "$DIR" || ! -f "$DIR/postgres.dump" || ! -f "$DIR/garage_data.tar.gz" || ! -f "$DIR/garage_meta.tar.gz" ]]; then
  echo "usage: $0 .backup/<utc-stamp>" >&2
  exit 1
fi

PROJECT="$(docker compose config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["name"])')"
ABS="$(cd "$DIR" && pwd)"
PG_USER="$(docker compose exec -T postgres printenv POSTGRES_USER | tr -d '\r')"
PG_DB="$(docker compose exec -T postgres printenv POSTGRES_DB | tr -d '\r')"

docker compose stop server web caddy garage

docker compose exec -T postgres pg_restore \
  -U "$PG_USER" \
  -d "$PG_DB" \
  --clean \
  --if-exists \
  --no-owner \
  <"$ABS/postgres.dump"

empty_and_restore() {
  local volume="$1" archive="$2"
  docker run --rm -v "${volume}:/data" alpine:3.24 sh -c 'find /data -mindepth 1 -maxdepth 1 -exec rm -rf {} +'
  docker run --rm -v "${volume}:/data" -v "${ABS}:/in:ro" alpine:3.24 tar xzf "/in/${archive}" -C /data
}

empty_and_restore "${PROJECT}_garage_data" garage_data.tar.gz
empty_and_restore "${PROJECT}_garage_meta" garage_meta.tar.gz

docker compose up -d
for _ in $(seq 1 30); do
  if curl -fsS "${PUBLIC_APP_URL:-http://localhost}/api/health" >/dev/null; then
    echo "restored from $ABS"
    exit 0
  fi
  sleep 2
done

echo "stack did not become healthy after restore" >&2
exit 1
