#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
ENV_FILE=${ENV_FILE:-"$ROOT_DIR/.env.production"}
export ENV_FILE
COMPOSE_FILE="$ROOT_DIR/compose.production.yaml"
BACKUP_ROOT=${BACKUP_DIR:-"$ROOT_DIR/backups"}
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
TARGET_DIR="$BACKUP_ROOT/$TIMESTAMP"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

sh "$ROOT_DIR/ops/validate-production-env.sh"
umask 077
mkdir -p "$TARGET_DIR"

if [[ -z "${TARGET_DIR// }" || "$TARGET_DIR" == "/" ]]; then
  echo "Unsicheres Backup-Ziel abgelehnt." >&2
  exit 1
fi

echo "Sichere PostgreSQL ..."
"${COMPOSE[@]}" exec -T database sh -c 'pg_dump --format=custom --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$TARGET_DIR/database.dump"

echo "Sichere Directus-Uploads ..."
"${COMPOSE[@]}" exec -T directus tar -C /directus/uploads -czf - . > "$TARGET_DIR/directus-uploads.tar.gz"

(
  cd "$TARGET_DIR"
  sha256sum database.dump directus-uploads.tar.gz > SHA256SUMS
)

echo "Backup abgeschlossen: $TARGET_DIR"
echo "Produktionsgeheimnisse sind bewusst nicht im Backup enthalten und müssen separat verschlüsselt gesichert werden."
