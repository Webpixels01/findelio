#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
ENV_FILE=${ENV_FILE:-"$ROOT_DIR/.env.production"}
export ENV_FILE
COMPOSE_FILE="$ROOT_DIR/compose.production.yaml"
compose_overlay=$(sed -n 's/^COMPOSE_OVERLAY_FILE=//p' "$ENV_FILE" | tail -n 1 | tr -d '\r')
external_proxy=0

if [[ -n "$compose_overlay" ]]; then
  if [[ "$compose_overlay" != "compose.production.external-proxy.yaml" ]]; then
    echo "Nicht erlaubtes Compose-Overlay: $compose_overlay" >&2
    exit 1
  fi
  if [[ ! -f "$ROOT_DIR/$compose_overlay" ]]; then
    echo "Compose-Overlay fehlt: $ROOT_DIR/$compose_overlay" >&2
    exit 1
  fi
  external_proxy=1
fi

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
if [[ "$external_proxy" -eq 1 ]]; then
  COMPOSE+=( -f "$ROOT_DIR/$compose_overlay" )
fi

sh "$ROOT_DIR/ops/validate-production-env.sh"
"${COMPOSE[@]}" config --quiet

# Check before building, migrating or replacing any running service. Docker
# Compose passes the key only to Directus, never to the frontend or build.
license_key=$(sed -n 's/^LICENSE_KEY=//p' "$ENV_FILE" | tail -n 1 | tr -d "\"'[:space:]")
if [[ -z "$license_key" ]]; then
  echo "LICENSE_KEY fehlt in .env.production. Directus wurde nicht verändert." >&2
  exit 1
fi
unset license_key

database_container=$("${COMPOSE[@]}" ps -q database 2>/dev/null || true)
directus_container=$("${COMPOSE[@]}" ps -q directus 2>/dev/null || true)
previous_directus_image=""
if [[ -n "$directus_container" ]]; then
  previous_directus_image=$(docker inspect --format '{{.Config.Image}}' "$directus_container")
fi
cms_upgrade_started=0
rollback_override=""
trap '[[ -z "$rollback_override" ]] || rm -f -- "$rollback_override"' EXIT
on_deploy_error() {
  local code=$1
  trap - ERR
  if [[ "$cms_upgrade_started" -eq 1 && "$previous_directus_image" == 'directus/directus:12.5.0' ]]; then
    echo "Upgrade-Prüfung fehlgeschlagen. Stelle Directus 12.5.0 mit derselben Datenbank wieder her ..." >&2
    rollback_override=$(mktemp)
    printf 'services:\n  directus:\n    image: directus/directus:12.5.0\n' > "$rollback_override"
    if "${COMPOSE[@]}" -f "$rollback_override" up -d --no-deps --force-recreate --wait directus &&
       "${COMPOSE[@]}" -f "$rollback_override" exec -T directus node cli.js cache clear &&
       "${COMPOSE[@]}" -f "$rollback_override" exec -T -e FINDELIO_EXPECTED_DIRECTUS_VERSION=12.5.0 app node --input-type=module - < "$ROOT_DIR/ops/check-directus-upgrade.mjs" &&
       "${COMPOSE[@]}" exec -T app node --input-type=module - < "$ROOT_DIR/ops/check-deployment.mjs"; then
      echo "Vorherige CMS-Version und Website wiederhergestellt; Upgrade nicht abgeschlossen." >&2
    else
      echo "Automatische Wiederherstellung fehlgeschlagen. Backup erhalten; bash ops/recover-directus.sh prüfen." >&2
    fi
  fi
  exit "$code"
}
trap 'on_deploy_error $?' ERR
if [[ -n "$database_container" && -n "$directus_container" ]]; then
  bash "$ROOT_DIR/ops/backup.sh"
else
  echo "Noch keine laufende Produktionsinstanz gefunden; vor diesem ersten Deployment ist die dokumentierte Datenübernahme erforderlich."
fi

echo "Baue das Frontend-Image ..."
"${COMPOSE[@]}" build app

echo "Lade das Directus-Image ..."
"${COMPOSE[@]}" pull directus

echo "Starte Datenbank und Cache ..."
"${COMPOSE[@]}" up -d --wait database cache

echo "Prüfe und ergänze Datenbankmigrationen ..."
"${COMPOSE[@]}" --profile tools run --rm migrate

echo "Lade Directus und Erweiterungen neu ..."
cms_upgrade_started=1
"${COMPOSE[@]}" up -d --force-recreate --wait directus
"${COMPOSE[@]}" exec -T directus node cli.js cache clear

# The existing frontend can verify the actual CMS reads before it is replaced.
if [[ -n "$("${COMPOSE[@]}" ps -q app)" ]]; then
  "${COMPOSE[@]}" exec -T app node --input-type=module - < "$ROOT_DIR/ops/check-directus-upgrade.mjs"
fi

if [[ "$external_proxy" -eq 1 ]]; then
  echo "Aktualisiere Frontend für den vorhandenen Reverse Proxy ..."
  "${COMPOSE[@]}" up -d --wait app
else
  echo "Aktualisiere Frontend und HTTPS-Proxy ..."
  "${COMPOSE[@]}" up -d --wait app proxy
  "${COMPOSE[@]}" exec -T proxy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
fi

echo "Prüfe Website, CMS und Sicherheitsfunktionen ..."
"${COMPOSE[@]}" exec -T app node --input-type=module - < "$ROOT_DIR/ops/check-directus-upgrade.mjs"
"${COMPOSE[@]}" exec -T app node --input-type=module - < "$ROOT_DIR/ops/check-deployment.mjs"

echo "Deployment abgeschlossen."
"${COMPOSE[@]}" ps
