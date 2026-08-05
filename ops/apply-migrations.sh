#!/bin/sh
set -eu

MIGRATIONS_DIR=${MIGRATIONS_DIR:-/migrations}
MIGRATION_TABLE=findelio_schema_migrations
BASELINE=${MIGRATION_BASELINE:-}
BASELINE_CHECK_TABLE=${MIGRATION_BASELINE_CHECK_TABLE:-}

psql -X -v ON_ERROR_STOP=1 -q <<SQL
CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
  filename text PRIMARY KEY,
  checksum char(64) NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

if [ -n "$BASELINE" ]; then
  case "$BASELINE" in
    *[!0-9a-zA-Z_.-]*)
      echo "Ungültiger MIGRATION_BASELINE-Wert." >&2
      exit 1
      ;;
  esac
  case "$BASELINE_CHECK_TABLE" in
    ""|*[!0-9a-zA-Z_]*)
      echo "Für das Baseline-Verfahren ist eine gültige MIGRATION_BASELINE_CHECK_TABLE erforderlich." >&2
      exit 1
      ;;
  esac

  table_exists=$(psql -X -Atq -v ON_ERROR_STOP=1 -c "SELECT to_regclass('public.${BASELINE_CHECK_TABLE}') IS NOT NULL;")
  if [ "$table_exists" != "t" ]; then
    echo "Baseline abgelehnt: Tabelle ${BASELINE_CHECK_TABLE} fehlt. Zuerst muss der bestehende Findelio-Datenbankstand wiederhergestellt werden." >&2
    exit 1
  fi

  baseline_found=false
  for migration_file in $(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | sort); do
    filename=$(basename "$migration_file")
    checksum=$(sha256sum "$migration_file" | awk '{print $1}')
    psql -X -v ON_ERROR_STOP=1 -q -c "INSERT INTO ${MIGRATION_TABLE} (filename, checksum) VALUES ('${filename}', '${checksum}') ON CONFLICT (filename) DO NOTHING;"
    if [ "$filename" = "$BASELINE" ]; then
      baseline_found=true
      break
    fi
  done

  if [ "$baseline_found" != "true" ]; then
    echo "Die konfigurierte Baseline-Datei wurde nicht gefunden: $BASELINE" >&2
    exit 1
  fi
fi

for migration_file in $(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | sort); do
  filename=$(basename "$migration_file")
  case "$filename" in
    *[!0-9a-zA-Z_.-]*)
      echo "Unsicherer Migrationsdateiname: $filename" >&2
      exit 1
      ;;
  esac

  checksum=$(sha256sum "$migration_file" | awk '{print $1}')
  stored_checksum=$(psql -X -Atq -v ON_ERROR_STOP=1 -c "SELECT checksum FROM ${MIGRATION_TABLE} WHERE filename = '${filename}';")

  if [ -n "$stored_checksum" ]; then
    if [ "$stored_checksum" != "$checksum" ]; then
      echo "Prüfsummenfehler: Eine bereits angewendete Migration wurde verändert: $filename" >&2
      exit 1
    fi
    echo "Bereits angewendet: $filename"
    continue
  fi

  echo "Wende Migration an: $filename"
  psql -X -v ON_ERROR_STOP=1 -f "$migration_file"
  psql -X -v ON_ERROR_STOP=1 -q -c "INSERT INTO ${MIGRATION_TABLE} (filename, checksum) VALUES ('${filename}', '${checksum}');"
done

echo "Alle Datenbankmigrationen sind aktuell."
