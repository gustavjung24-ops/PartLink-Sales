# SPARELINK Backup And Disaster Recovery

Operational backup assets live in this directory so DevOps can run, audit, and test them from the monorepo.

## PostgreSQL

- Daily physical base backup: `infra/backup/postgres/backup-base.sh`
- Continuous WAL archive hook: `infra/backup/postgres/archive-wal.sh`
- Retention pruning: `infra/backup/postgres/prune-old-backups.sh`
- Backup verification: `infra/backup/postgres/verify-backup.sh`
- PITR restore runbook: `infra/backup/postgres/restore-pitr.sh`

### Backup policy

- WAL archiving must be enabled on the primary server.
- Daily base backup retention: minimum 30 days.
- WAL retention: minimum 7 days, and never shorter than the expected PITR window.
- Off-site storage: set `S3_BACKUP_URI` so each base backup and WAL segment is copied out of the primary environment.

### Required PostgreSQL settings

```conf
wal_level = replica
archive_mode = on
archive_timeout = 300
archive_command = 'envdir /etc/sparelink/backup-env bash /opt/sparelink/infra/backup/postgres/archive-wal.sh %p %f'
max_wal_senders = 10
```

Use a dedicated env file that exports the variables from `infra/backup/env.example`.

### Recovery drill cadence

- Weekly: run `verify-backup.sh` against the newest base backup.
- Monthly: perform a full restore into staging and record duration.
- Quarterly: perform a point-in-time recovery drill and validate application smoke tests.

## Desktop SQLite Cache

The desktop app now includes a startup maintenance service in `apps/desktop/src/main/services/sqliteCacheRecovery.ts`.

- Runs `PRAGMA integrity_check(1)` at app startup.
- Quarantines corrupt databases before deleting them.
- Supports rebuilding the cache from the server through a callback hook.
- Exposes a `backupBeforeOverwrite()` method for sync flows that replace the local cache.

Current default database path:

```text
<userData>/cache/offline-cache.sqlite
```

Override it with `SPARELINK_SQLITE_CACHE_PATH` if the production desktop build stores the cache elsewhere.

## License Server Availability

- Target uptime SLA: 99.9% monthly for the license API.
- Planned maintenance window: up to 4 hours/month, announced at least 24 hours ahead.
- Offline grace on the desktop must be longer than the maintenance window. The current 24 hour grace window satisfies this requirement.
- Incident target: restore validation service within 1 hour or extend grace via emergency server-side policy.

## Restore Procedure

1. Freeze application writes.
2. Restore the latest physical base backup with `restore-pitr.sh`.
3. Set `RECOVERY_TARGET_TIME` when a point-in-time restore is required.
4. Start PostgreSQL and wait for recovery completion.
5. Run application smoke tests and integrity queries.
6. Re-enable traffic only after validation succeeds.

## Ownership

- Primary owner: DevOps
- Supporting owners: Backend lead, Desktop lead