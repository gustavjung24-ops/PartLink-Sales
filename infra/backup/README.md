# SPARELINK Backup And Disaster Recovery

Operational backup assets live in this directory so DevOps can run, audit, and test them from the monorepo.

## RTO / RPO Targets

| Component          | RPO                      | RTO                      |
|--------------------|--------------------------|--------------------------|
| PostgreSQL         | ≤ 1 hour (WAL archiving) | ≤ 4 hours                |
| SQLite cache       | ≤ 1 sync cycle           | Immediate (auto-rebuild) |
| License server     | ≤ 24 hours               | ≤ 1 hour                 |

## PostgreSQL

- Daily physical base backup: `infra/backup/postgres/backup-base.sh`
- Continuous WAL archive hook: `infra/backup/postgres/archive-wal.sh`
- Supplementary logical backup: `infra/backup/postgres/backup-logical.sh`
- Retention pruning: `infra/backup/postgres/prune-old-backups.sh`
- Backup verification: `infra/backup/postgres/verify-backup.sh`
- PITR restore runbook: `infra/backup/postgres/restore-pitr.sh`
- Failure alerting: `infra/backup/postgres/notify-failure.sh`

### Backup strategy

`pg_basebackup` is the **primary** backup method. It produces a physical base backup that is required for true Point-in-Time Recovery (PITR) when combined with WAL archiving.

`pg_dump` (via `backup-logical.sh`) is a **supplementary** logical backup. It provides schema portability, cross-version migration support, and per-table restore capability. It cannot replace the physical backup for PITR.

### Backup policy

- WAL archiving must be enabled on the primary server.
- Daily base backup retention: minimum 30 days.
- WAL retention: minimum 7 days, and never shorter than the expected PITR window.
- Off-site storage: set `S3_BACKUP_URI` so each base backup, WAL segment, and logical dump is copied out of the primary environment.
- Supplementary logical backup: run weekly (or after schema migrations).

### Encryption

All backup data must be encrypted at rest and in transit:

- **In transit**: `PGSSLMODE=require` enforces TLS for all `pg_basebackup` and `pg_dump` connections. All AWS CLI S3 uploads use HTTPS.
- **At rest**: set `S3_KMS_KEY_ID` to an AWS KMS key ARN/alias. Every S3 upload (base backup, WAL, logical dump) will use `--sse aws:kms --sse-kms-key-id`. Never upload without encryption.
- **Key management**: the KMS key ID must be injected at runtime from a secrets manager (Vault, AWS Secrets Manager, etc.). Never hard-code it in source code or environment files committed to the repository.

### S3 bucket hardening

Apply `infra/backup/s3-bucket-policy.json` to the S3 bucket and configure:

- Public access: **block all public access** (S3 Block Public Access settings enabled).
- Versioning: **enabled** to protect against accidental deletion.
- Cross-region replication: **enabled** to a separate AWS region for geographic redundancy.
- Bucket policy: restricts PutObject/GetObject to the `sparelink-backup-role` IAM role only and **denies unencrypted uploads**.
- Lifecycle policy: transition objects older than 90 days to Glacier Deep Archive.

### Required PostgreSQL settings

```conf
wal_level = replica
archive_mode = on
archive_timeout = 300
archive_command = 'envdir /etc/sparelink/backup-env bash /opt/sparelink/infra/backup/postgres/archive-wal.sh %p %f'
max_wal_senders = 10
```

Use a dedicated env file that exports the variables from `infra/backup/env.example`.

### Backup failure alerting

Configure at least one alerting channel via `env.example`:

- `BACKUP_ALERT_WEBHOOK` — Slack, Teams, or PagerDuty incoming webhook URL. Called immediately on any backup script failure.
- `BACKUP_ALERT_EMAIL` — email recipient (requires `mail` utility on the backup host).

An alert fires when any backup job exits with a non-zero status. Additionally, monitor `backup_age_minutes` in your observability stack and alert if no successful backup has been recorded in the last 25 hours.

### Recovery drill cadence

- **Weekly**: run `verify-backup.sh` against the newest base backup.
- **Monthly**: perform a full physical restore into staging, record duration, and sign off in `infra/backup/restore-drill-log.md`.
- **Quarterly**: perform a point-in-time recovery drill and validate application smoke tests.

All drill results must be recorded in `infra/backup/restore-drill-log.md` with date, duration, RTO/RPO confirmation, and two signatures.

## Desktop SQLite Cache

The desktop app includes a startup maintenance service in `apps/desktop/src/main/services/sqliteCacheRecovery.ts`.

- Runs `PRAGMA integrity_check(1)` at app startup.
- Quarantines corrupt databases before deleting them.
- Supports rebuilding the cache from the server through a callback hook.
- Exposes a `backupBeforeOverwrite()` method for sync flows that replace the local cache; every call is logged for audit purposes.

### Sync conflict resolution strategy

When a sync overwrite occurs (server data replaces the local cache):

1. The local database is backed up to `<userData>/cache/backups/` before any write.
2. The backup path and timestamp are written to the application log.
3. **Server wins** — the authoritative server state replaces local data. Manual merge is not supported in the current version.
4. If the server-provided data fails its own integrity check after being written, the service falls back to the pre-sync backup automatically.

Current default database path:

```text
<userData>/cache/offline-cache.sqlite
```

Override it with `SPARELINK_SQLITE_CACHE_PATH` if the production desktop build stores the cache elsewhere.

## License Server Availability

- Target uptime SLA: 99.9% monthly for the license API.
- Planned maintenance window: up to 4 hours/month, announced at least 24 hours ahead.
- Offline grace on the desktop must be longer than the maintenance window. The current 24-hour grace window satisfies this requirement.
- Incident target: restore validation service within 1 hour or extend grace via emergency server-side policy.

### License server data backup

- Activation records and license keys stored on the license server must be backed up daily using the same PostgreSQL backup scripts configured for the main database (or equivalent tooling if the license server uses a separate datastore).
- The license server recovery procedure is documented in `docs/architecture/LICENSE_SYSTEM.md`.
- Recovery drill for the license server must be included in the quarterly DR drill.

## Restore Procedure

1. Freeze application writes.
2. Restore the latest physical base backup with `restore-pitr.sh`.
3. Set `RECOVERY_TARGET_TIME` when a point-in-time restore is required.
4. Start PostgreSQL and wait for recovery completion.
5. Run application smoke tests and integrity queries.
6. Re-enable traffic only after validation succeeds.
7. Record the drill outcome in `infra/backup/restore-drill-log.md`.

## Ownership

- Primary owner: DevOps
- Supporting owners: Backend lead, Desktop lead