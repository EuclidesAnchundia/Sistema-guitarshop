#!/bin/sh
set -e

REPL_USER="${REPLICATION_USER:-replicator}"
REPL_PASS="${REPLICATION_PASSWORD:-replicatorpass}"
export PGPASSWORD="$REPL_PASS"

echo "[replica] Starting replica entrypoint..."

apk add --no-cache su-exec >/dev/null 2>&1 || true

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[replica] No data found. Running pg_basebackup from primary..."
  rm -rf "$PGDATA"/*
  pg_basebackup -h db -U "$REPL_USER" -D "$PGDATA" -Fp -Xs -P -R
  echo "[replica] Base backup complete."
else
  echo "[replica] Data already exists. Skipping base backup."
fi

# Permisos correctos para Postgres
chown -R postgres:postgres "$PGDATA" || true
chmod 0700 "$PGDATA" || true

# (opcional pero recomendado) asegurar permisos a todo el árbol
find "$PGDATA" -type d -exec chmod 0700 {} \; 2>/dev/null || true

echo "listen_addresses='*'" >> "$PGDATA/postgresql.conf"
echo "hot_standby=on" >> "$PGDATA/postgresql.conf"

echo "[replica] Launching postgres as postgres..."
exec su-exec postgres postgres -D "$PGDATA"
