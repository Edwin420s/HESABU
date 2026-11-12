#!/bin/bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <path_to_backup_file.sql.gz>"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Error: Backup file '${BACKUP_FILE}' not found."
    exit 1
fi

echo "Starting HESABU PostgreSQL restore from ${BACKUP_FILE} at $(date)..."

CONTAINER_NAME=""
if command -v docker >/dev/null 2>&1; then
    CONTAINER_NAME=$(docker ps --format '{{.Names}}' | grep "hesabu-postgres" | head -n 1 || true)
fi

if [ -n "${CONTAINER_NAME}" ]; then
    DB_NAME="${POSTGRES_DB:-$([ "${CONTAINER_NAME}" = "hesabu-postgres-prod" ] && echo "hesabu_db" || echo "hesabu")}"
    DB_USER="${POSTGRES_USER:-hesabu}"
    echo "Restoring into container: ${CONTAINER_NAME} (database: ${DB_NAME})..."
    gunzip -c "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}"
else
    DB_NAME="${POSTGRES_DB:-hesabu}"
    DB_USER="${POSTGRES_USER:-hesabu}"
    echo "Restoring via host psql (database: ${DB_NAME})..."
    gunzip -c "${BACKUP_FILE}" | psql -U "${DB_USER}" -d "${DB_NAME}"
fi

echo "Database restore completed successfully."
