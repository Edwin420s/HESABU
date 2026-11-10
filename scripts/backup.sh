#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="${BACKUP_DIR}/hesabu_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "Starting HESABU PostgreSQL backup at $(date)..."

# Dump database using docker container or host pg_dump
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "hesabu-postgres"; then
    docker exec hesabu-postgres pg_dump -U hesabu hesabu_db | gzip > "${FILENAME}"
else
    pg_dump -U "${POSTGRES_USER:-hesabu}" "${POSTGRES_DB:-hesabu_db}" | gzip > "${FILENAME}"
fi

echo "Backup completed successfully: ${FILENAME}"
echo "Size: $(du -h "${FILENAME}" | cut -f1)"

# Retain only last 7 daily backups
find "${BACKUP_DIR}" -name "hesabu_backup_*.sql.gz" -type f -mtime +7 -delete
echo "Old backups pruned."
