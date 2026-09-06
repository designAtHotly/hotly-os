#!/usr/bin/env bash
# Backup PostgreSQL and Garage volumes. Run from the Compose project directory.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${1:-$ROOT/.backup/$STAMP}"
mkdir -p "$OUT"

PROJECT="$(docker compose config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["name"])')"
PG_USER="$(docker compose exec -T postgres printenv POSTGRES_USER | tr -d '\r')"
PG_DB="$(docker compose exec -T postgres printenv POSTGRES_DB | tr -d '\r')"

if ! docker compose exec -T postgres pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null; then
  echo "postgres is not ready" >&2
  exit 1
fi

docker compose exec -T postgres pg_dump \
  -U "$PG_USER" \
  -d "$PG_DB" \
  --no-owner \
  --format=custom \
  >"$OUT/postgres.dump"

docker run --rm \
  -v "${PROJECT}_garage_data:/data:ro" \
  -v "$OUT:/out" \
  alpine:3.24 tar czf /out/garage_data.tar.gz -C /data .

docker run --rm \
  -v "${PROJECT}_garage_meta:/data:ro" \
  -v "$OUT:/out" \
  alpine:3.24 tar czf /out/garage_meta.tar.gz -C /data .

echo "$OUT"
