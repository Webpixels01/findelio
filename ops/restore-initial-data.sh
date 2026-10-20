#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
ENV_FILE=${ENV_FILE:-"$ROOT_DIR/.env.production"}
BACKUP_DIR=${BACKUP_DIR:-}
COMPOSE_FILE="$ROOT_DIR/compose.production.yaml"

if [[ -z "$BACKUP_DIR" ]]; then
  echo "BACKUP_DIR muss auf das geprüfte Umzugsbackup zeigen." >&2
  exit 1
fi

if [[ ! -f "$BACKUP_DIR/database.dump" || ! -f "$BACKUP_DIR/directus-uploads.tar.gz" ]]; then
  echo "Backup-Dateien fehlen in: $BACKUP_DIR" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fehlt: $ENV_FILE" >&2
  exit 1
fi

db_user=$(sed -n 's/^POSTGRES_USER=//p' "$ENV_FILE" | tail -n 1 | tr -d '\r')
db_name=$(sed -n 's/^POSTGRES_DB=//p' "$ENV_FILE" | tail -n 1 | tr -d '\r')
if [[ -z "$db_user" || -z "$db_name" ]]; then
  echo "POSTGRES_USER oder POSTGRES_DB fehlt in .env.production." >&2
  exit 1
fi

compose_overlay=$(sed -n 's/^COMPOSE_OVERLAY_FILE=//p' "$ENV_FILE" | tail -n 1 | tr -d '\r')
if [[ -n "$compose_overlay" && "$compose_overlay" != "compose.production.external-proxy.yaml" ]]; then
  echo "Nicht erlaubtes Compose-Overlay: $compose_overlay" >&2
  exit 1
fi
if [[ -n "$compose_overlay" && ! -f "$ROOT_DIR/$compose_overlay" ]]; then
  echo "Compose-Overlay fehlt: $ROOT_DIR/$compose_overlay" >&2
  exit 1
fi

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
if [[ -n "$compose_overlay" ]]; then
  COMPOSE+=( -f "$ROOT_DIR/$compose_overlay" )
fi

sh "$ROOT_DIR/ops/validate-production-env.sh"
"${COMPOSE[@]}" config --quiet

if [[ -n $("${COMPOSE[@]}" ps -q directus 2>/dev/null || true) ]]; then
  echo "Directus läuft bereits. Für die einmalige Datenübernahme muss der Zielstand noch nicht gestartet sein." >&2
  exit 1
fi

echo "Starte nur die leere Produktionsdatenbank und Redis ..."
"${COMPOSE[@]}" up -d --wait database cache

database_container=$("${COMPOSE[@]}" ps -q database)
if [[ -z "$database_container" ]]; then
  echo "Produktionsdatenbank konnte nicht gestartet werden." >&2
  exit 1
fi

existing_table_count=$("${COMPOSE[@]}" exec -T database psql -X -Atq -v ON_ERROR_STOP=1 -U "$db_user" -d "$db_name" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d '[:space:]')
if [[ "$existing_table_count" != "0" ]]; then
  echo "Zieldatenbank ist nicht leer (${existing_table_count} Tabellen). Import abgebrochen." >&2
  exit 1
fi

echo "Prüfe den Datenbank-Dump ..."
dump_temp=/tmp/findelio-initial-database.dump
docker cp "$BACKUP_DIR/database.dump" "$database_container:$dump_temp" >/dev/null
docker exec "$database_container" pg_restore --list "$dump_temp" >/dev/null

echo "Stelle PostgreSQL-Daten wieder her ..."
docker exec "$database_container" pg_restore \
  --exit-on-error \
  --no-owner \
  --no-acl \
  -U "$db_user" \
  -d "$db_name" \
  "$dump_temp"
docker exec "$database_container" rm -f "$dump_temp"

echo "Prüfe das leere Upload-Volume ..."
upload_probe=$("${COMPOSE[@]}" run --rm --no-deps -T --entrypoint sh directus -c 'find /directus/uploads -mindepth 1 -maxdepth 1 -print -quit')
if [[ -n "$upload_probe" ]]; then
  echo "Das Upload-Volume ist nicht leer. Import abgebrochen." >&2
  exit 1
fi

echo "Stelle Directus-Uploads wieder her ..."
cat "$BACKUP_DIR/directus-uploads.tar.gz" | "${COMPOSE[@]}" run --rm --no-deps -T --entrypoint sh directus -c 'tar -C /directus/uploads -xzf -'

restored_table_count=$("${COMPOSE[@]}" exec -T database psql -X -Atq -v ON_ERROR_STOP=1 -U "$db_user" -d "$db_name" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d '[:space:]')
if [[ "$restored_table_count" == "0" ]]; then
  echo "Nach der Wiederherstellung wurden keine Tabellen gefunden." >&2
  exit 1
fi

echo "Datenbank und Directus-Uploads wurden sicher wiederhergestellt."
echo "Als Nächstes: bash ops/deploy.sh"
