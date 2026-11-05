#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 || $# -gt 3 ]]; then
  cat >&2 <<'USAGE'
Usage:
  bash tools/backup/verify-restore.sh <encrypted-backup.age> <age-identity-file> [SHA256SUMS]

The script decrypts into a temporary directory, restores into a disposable
PostgreSQL 18 Docker container on localhost:55432, checks the four Prunex
archive tables and their RLS flags, prints row counts, then removes the
container and plaintext dump. It never connects to the production database.
USAGE
  exit 2
fi

encrypted_backup="$(realpath "$1")"
identity_file="$(realpath "$2")"
checksum_file="${3:-}"

for command in age docker sha256sum realpath openssl; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Required command not found: $command" >&2
    exit 1
  }
done

[[ -s "$encrypted_backup" ]] || { echo "Encrypted backup is missing or empty." >&2; exit 1; }
[[ -s "$identity_file" ]] || { echo "Age identity file is missing or empty." >&2; exit 1; }
[[ "$(head -n 1 "$encrypted_backup")" == "age-encryption.org/v1" ]] || {
  echo "Input does not have an age encryption header." >&2
  exit 1
}

if [[ -n "$checksum_file" ]]; then
  checksum_file="$(realpath "$checksum_file")"
  checksum_dir="$(dirname "$checksum_file")"
  (
    cd "$checksum_dir"
    sha256sum --check "$(basename "$checksum_file")"
  )
fi

restore_dir="$(mktemp -d)"
container_name="prunex-restore-drill-$$"
container_started=0

cleanup() {
  if [[ "$container_started" == "1" ]]; then
    docker rm --force "$container_name" >/dev/null 2>&1 || true
  fi
  rm -rf "$restore_dir"
}
trap cleanup EXIT INT TERM

chmod 700 "$restore_dir"
age --decrypt --identity "$identity_file" \
  --output "$restore_dir/prunex-neon.dump" "$encrypted_backup"

docker run --rm --volume "$restore_dir:/backup:ro" postgres:18 \
  pg_restore --list /backup/prunex-neon.dump >/dev/null || {
    echo "Decrypted file is not a readable PostgreSQL custom-format dump." >&2
    exit 1
  }

if docker ps --format '{{.Ports}}' | grep -q '127.0.0.1:55432->'; then
  echo "Port 55432 is already in use. Stop the other local container and retry." >&2
  exit 1
fi

restore_password="$(openssl rand -hex 24)"
docker run --detach --name "$container_name" \
  --env "POSTGRES_PASSWORD=$restore_password" \
  --publish 127.0.0.1:55432:5432 \
  postgres:18 >/dev/null
container_started=1

ready=0
for ((attempt = 1; attempt <= 60; attempt++)); do
  if docker exec "$container_name" pg_isready -U postgres >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
[[ "$ready" == "1" ]] || { echo "Temporary PostgreSQL 18 did not become ready." >&2; exit 1; }

docker exec "$container_name" createdb -U postgres prunex_restore
docker cp "$restore_dir/prunex-neon.dump" "$container_name:/tmp/prunex-neon.dump"
docker exec "$container_name" pg_restore \
  --exit-on-error --no-owner --no-acl \
  --dbname=prunex_restore /tmp/prunex-neon.dump

result="$(docker exec "$container_name" psql -X -v ON_ERROR_STOP=1 -U postgres -d prunex_restore -At <<'SQL'
SELECT 'games=' || count(*) FROM prunex_archive.games;
SELECT 'game_reviews=' || count(*) FROM prunex_archive.game_reviews;
SELECT 'position_memory=' || count(*) FROM prunex_archive.position_memory;
SELECT 'migration_state=' || count(*) FROM prunex_archive.migration_state;
SELECT 'rls_tables=' || count(*)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='prunex_archive'
  AND c.relkind='r'
  AND c.relname IN ('games','game_reviews','position_memory','migration_state')
  AND c.relrowsecurity;
SQL
)"

rls_count="$(printf '%s\n' "$result" | sed -n 's/^rls_tables=//p')"
if [[ "$rls_count" != "4" ]]; then
  echo "Restore completed, but expected RLS on all four archive tables; got: $rls_count" >&2
  printf '%s\n' "$result"
  exit 1
fi

echo "RESTORE DRILL PASSED — isolated PostgreSQL 18 database"
printf '%s\n' "$result"
echo "The temporary database and decrypted dump will now be removed."
