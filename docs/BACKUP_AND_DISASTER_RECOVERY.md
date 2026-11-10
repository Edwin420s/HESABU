# Backup and Disaster Recovery Guide

This document describes the backup policies, retention schedules, and disaster recovery procedures for HESABU deployments.

---

## 1. Backup Strategy

HESABU maintains an automated daily backup routine for PostgreSQL instances. Because all financial movements are recorded as balanced double-entry journals in integer minor units, full database state dumps provide deterministic point-in-time recovery.

### Backup Schedule
- **Daily Automated Backups**: Executed via cron or systemd timer triggering `scripts/backup.sh`.
- **Pre-Migration Backups**: Triggered before running Prisma database schema updates or major migrations.
- **On-Demand Snapshots**: Available before significant fiscal period closures.

---

## 2. Retention Policy

- **Active Backups**: Stored locally in compressed format (`.sql.gz`) for 7 days.
- **Secondary Off-Site Storage**: Encrypted snapshots uploaded to S3-compatible or cold cloud storage with 90-day retention.
- **Automated Pruning**: `scripts/backup.sh` automatically prunes local archive files older than 7 days.

---

## 3. Restoration Procedure

To restore from a backup file:

1. **Stop Application Containers**:
   ```bash
   docker compose stop api
   ```

2. **Decompress and Stream into PostgreSQL**:
   ```bash
   gunzip -c ./backups/hesabu_backup_YYYYMMDD_HHMMSS.sql.gz | docker exec -i hesabu-postgres psql -U hesabu -d hesabu_db
   ```

3. **Verify Integrity**:
   Execute the trial balance report endpoint or health check:
   ```bash
   curl -s http://localhost:4000/api/health | jq .
   ```

4. **Restart Application**:
   ```bash
   docker compose start api
   ```
