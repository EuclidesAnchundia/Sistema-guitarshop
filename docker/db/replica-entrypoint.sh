#!/bin/sh
set -e

REPL_USER="${REPLICATION_USER:-replicator}"
REPL_PASS="${REPLICATION_PASSWORD:-replicatorpass}"

export PGPASSWORD="$REPL_PASS"

echo "[replica] Starting replica entrypoint..."

# Si no hay datos aún, clonar desde el primary
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[replica] No data found. Running pg_basebackup from primary..."
  rm -rf "$PGDATA"/*
  pg_basebackup -h db -U "$REPL_USER" -D "$PGDATA" -Fp -Xs -P -R
  echo "[replica] Base backup complete."
else
  echo "[replica] Data already exists. Skipping base backup."
fi

# Asegurar standby
echo "listen_addresses='*'" >> "$PGDATA/postgresql.conf"
echo "hot_standby=on" >> "$PGDATA/postgresql.conf"

echo "[replica] Launching postgres..."
exec postgres
