#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="${BACKUP_DIR}/hesabu_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "Starting HESABU PostgreSQL backup at $(date)..."

# Detect running postgres container dynamically (supports hesabu-postgres-prod and hesabu-postgres)
CONTAINER_NAME=""
if command -v docker >/dev/null 2>&1; then
    CONTAINER_NAME=$(docker ps --format '{{.Names}}' | grep "hesabu-postgres" | head -n 1 || true)
fi

if [ -n "${CONTAINER_NAME}" ]; then
    DB_NAME="${POSTGRES_DB:-$([ "${CONTAINER_NAME}" = "hesabu-postgres-prod" ] && echo "hesabu_db" || echo "hesabu")}"
    DB_USER="${POSTGRES_USER:-hesabu}"
    echo "Dumping from active container: ${CONTAINER_NAME} (database: ${DB_NAME})..."
    docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${FILENAME}"
else
    DB_NAME="${POSTGRES_DB:-hesabu}"
    DB_USER="${POSTGRES_USER:-hesabu}"
    echo "Dumping via host pg_dump (database: ${DB_NAME})..."
    pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${FILENAME}"
fi

echo "Backup completed successfully: ${FILENAME}"
echo "Size: $(du -h "${FILENAME}" | cut -f1)"

# Retain only last 7 daily backups
find "${BACKUP_DIR}" -name "hesabu_backup_*.sql.gz" -type f -mtime +7 -delete
echo "Old backups pruned."
