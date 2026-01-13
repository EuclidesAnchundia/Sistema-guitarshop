#!/bin/sh
set -e

echo "[primary-init] Configuring primary for streaming replication..."

REPL_USER="${REPLICATION_USER:-replicator}"
REPL_PASS="${REPLICATION_PASSWORD:-replicatorpass}"

# Crear usuario replicador
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${REPL_USER}') THEN
      CREATE ROLE ${REPL_USER} WITH REPLICATION LOGIN PASSWORD '${REPL_PASS}';
    END IF;
  END
  \$\$;
EOSQL

# Permitir replicación desde red Docker
echo "host replication ${REPL_USER} 0.0.0.0/0 md5" >> "$PGDATA/pg_hba.conf"

# Parámetros de replicación
cat >> "$PGDATA/postgresql.conf" <<EOF

# --- Replication settings ---
listen_addresses = '*'
wal_level = replica
max_wal_senders = 10
max_replication_slots = 10
hot_standby = on
EOF

echo "[primary-init] Done."
