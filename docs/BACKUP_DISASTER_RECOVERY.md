# Database Backup & Disaster Recovery Strategy

## Overview

PartLink implements a comprehensive backup and recovery strategy for PostgreSQL database, SQLite cache, and License Server with multiple layers of protection.

### RTO/RPO Targets by Component

| Component | RPO | RTO | Justification |
|-----------|-----|-----|---|
| PostgreSQL (Primary) | ≤ 1 hour | ≤ 4 hours | Critical business data; 24h window acceptable for partial outage |
| SQLite Cache (Desktop) | ≤ 1 sync cycle | Immediate | Self-rebuilds automatically from server; no manual recovery needed |
| License Server | ≤ 1 hour | ≤ 2 hours | Activation records must be recoverable; extended uptime acceptable |

**Definitions:**
- **RPO (Recovery Point Objective)**: Maximum acceptable data loss measured in time
- **RTO (Recovery Time Objective)**: Maximum acceptable downtime before recovery completes
- **Compliance**: RTO/RPO approved by stakeholders and documented in SLAs

---

## 1. Backup Strategy

### 1.0 Encryption & Security

**Backup Encryption Requirements:**

All backups MUST be encrypted both at rest and in transit:

```yaml
At Rest (Storage):
  - S3 Backups: AES-256 encryption (SSE-S3 or SSE-KMS)
  - Local Backups: AES-256 encrypted via pgBackRest
  - Encryption Keys: Managed via AWS Secrets Manager / HashiCorp Vault
  - Key Rotation: Every 90 days; old keys retained for decryption

In Transit (Network):
  - All backup transfers: TLS 1.3 minimum
  - S3 requests: Enforce TLS via bucket policy
  - WAL archiving: Use HTTPS endpoints only

Key Management:
  - Encryption keys NEVER hardcoded in scripts
  - Separate recovery key stored in different secure vault
  - Multi-person approval required for key access
  - All key access logged and audited
```

### 1.1 Primary Backup Method: pg_basebackup (Physical Backups)

**Purpose:** Physical full backups compatible with Point-In-Time Recovery (PITR)

- **Frequency**: Daily at 2:00 AM UTC
- **Retention**: 30 days
- **Method**: `pg_basebackup` physical base backup (PITR-compatible)
- **Location**: S3 bucket with AES-256 encryption
- **Tool**: pgBackRest or Barman for automation & WAL management

```bash
# Daily physical base backup via pgBackRest
pgbackrest backup --type=full --repo=s3

# Configuration (pgbackrest.conf):
[global]
repo1-type=s3
repo1-s3-bucket=sparelink-backups-prod
repo1-s3-region=us-east-1
repo1-s3-key=${AWS_ACCESS_KEY_ID}
repo1-s3-key-secret=${AWS_SECRET_ACCESS_KEY}
repo1-cipher-type=aes-256-cbc
repo1-cipher-pass=${BACKUP_ENCRYPTION_KEY}

[stanza=prod]
pg1-path=/var/lib/postgresql/15/main
```

### 1.2 Supplementary Backup Method: pg_dump (Logical Backups)

**Purpose:** Logical backups for schema verification, portability, and supplementary protection

- **Frequency**: Daily at 3:00 AM UTC (after pg_basebackup completes)
- **Retention**: 14 days
- **Scope**: Full database schema + data (or schema-only for rapid testing)
- **Location**: S3 encrypted bucket (separate prefix from physical backups)

```bash
# Logical backup with compression & encryption
pg_dump --verbose \
  --format=custom \
  --compress=9 \
  --blobs \
  postgresql://user:pass@localhost/sparelink | \
  gpg --symmetric --cipher-algo AES256 --armor > backup.sql.custom.gpg

# Upload to S3
aws s3 cp backup.sql.custom.gpg s3://sparelink-backups-prod/logical/ \
  --sse=AES256 \
  --metadata="backup-type=logical,timestamp=$(date -Iseconds)"
```

### 1.3 Incremental Backups (WAL Archive)
- **Frequency**: Continuous via PostgreSQL WAL archiving
- **Method**: pgBackRest for managed WAL shipping
- **Retention**: 7 days of WAL files
- **Storage**: S3, with 99.999999999% durability

```sql
-- PostgreSQL WAL archiving configuration
-- In postgresql.conf:
wal_level = replica
max_wal_senders = 10
wal_keep_size = 1GB
archive_mode = on
archive_command = 'pgbackrest --stanza=prod archive-push %p'
archive_timeout = 300
```

### 1.4 Point-in-Time Recovery (PITR)
- Enables recovery to any second within WAL retention period (7 days)
- Combine a physical base backup + subsequent WAL files
- Tested monthly via DR drills

---

## 2. Backup Verification

### Automated Integrity Checks
- Test restore from backup weekly to S3-backed test instance
- Validate schema consistency post-restore
- Verify checksums on stored backups

```python
# Backup verification job (runs weekly)
def verify_backup(backup_path):
    """Test restore from backup to verify integrity"""
    test_db_conn = pg_connect(test_db_url)
    restore_from_backup(backup_path, test_db_conn)
    
    # Run integrity checks
    check_table_counts(test_db_conn)
    check_foreign_keys(test_db_conn)
    check_indexes(test_db_conn)
    
    return True
```

---

## 3. Disaster Recovery Procedures

### 3.1 Full Database Recovery
1. Stop application servers
2. **Restore from latest physical base backup:**
   ```bash
  tar -xzf base_latest.tar.gz -C ${PGDATA}
   ```
3. **Apply WAL files to recover to point-in-time:**
   ```bash
   # Set recovery target timestamp
   # recovery_target_timeline = 'latest'
   # recovery_target_time = '2025-03-22 14:30:00'
   ```
4. Verify data integrity via queries
5. Restart application servers

**Estimated Recovery Time**: 15-45 minutes

### 3.2 Partial Recovery (Single Table)
- Restore to separate database instance
- Extract table via `pg_dump | pg_restore`
- Migrate data back to production via UPSERT

```sql
-- Example: recover specific table
CREATE TABLE products_recovered AS
SELECT * FROM products_from_backup_db;

-- Merge back with conflict handling
INSERT INTO products (id, name, ...)
SELECT id, name, ... FROM products_recovered
ON CONFLICT (id) DO UPDATE SET
  updated_at = EXCLUDED.updated_at
WHERE EXCLUDED.updated_at > products.updated_at;
```

### 3.3 Replica Failover (HA Setup)
- In production: maintain read replicas with synchronous replication
- Automatic failover via tools like Patroni or Stolon
- Failover time: < 30 seconds from primary failure detection

---

## 4. Production Deployment

### 4.1 Managed Database Service (Recommended)

**AWS RDS PostgreSQL:**
```
- Multi-AZ deployment (automatic failover)
- Automated snapshots (30-day retention)
- Automated backups with point-in-time recovery
- Encryption at rest (AES-256)
- Monthly maintenance windows
```

Configuration example:
```terraform
resource "aws_db_instance" "sparelink" {
  identifier            = "sparelink-prod"
  engine                = "postgres"
  engine_version        = "15.3"
  instance_class        = "db.t3.large"
  allocated_storage     = 100
  max_allocated_storage = 500  # auto-scaling
  
  # HA & Backups
  multi_az                     = true
  publicly_accessible          = false
  backup_retention_period      = 30
  backup_window                = "02:00-03:00"    # UTC
  maintenance_window           = "sun:03:00-04:00" # UTC
  
  # Security
  storage_encrypted            = true
  kms_key_id                   = aws_kms_key.rds.arn
  
  # Performance
  performance_insights_enabled = true
  
  tags = { Name = "sparelink-prod" }
}
```

### 4.2 Self-Hosted with Backup Automation

**Prerequisites:**
- PostgreSQL 14+ with WAL archiving enabled
- Dedicated backup server or S3 bucket
- Monitoring & alerting (check backup success daily)

**Backup automation stack:**
```
1. PgBackRest or WAL-E: Continuous WAL + daily full backups
2. AWS S3 or GCS: Backup storage with replication
3. Prometheus + Alerting: Monitor backup success (success rate > 99%)
4. Cron jobs: Automated integrity verification weekly
```

---

## 5. Monitoring & Alerting

### 5.1 Required Alerts

All alerts must be configured with critical escalation (PagerDuty, Slack webhooks, or email):

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| **Backup Failed** | Any backup job exits with error code | CRITICAL | Notify on-call DBA immediately |
| **Backup Staleness** | Last successful backup > 25 hours ago | CRITICAL | Escalate; investigate backup pipeline |
| **WAL Archive Backlog** | WAL files pending archive > 1GB | WARNING | Check S3 connectivity; verify credentials |
| **S3 Replication Lag** | Backup not replicated to DR region > 2h | WARNING | Verify replication settings |
| **Encryption Key Access Failure** | Backup encryption key unreadable | CRITICAL | Trigger incident; verify key manager availability |

### 5.2 Key Metrics

```yaml
# Backup Performance Metrics
backup_size_bytes:                # Alert if growth > 20%/day
backup_duration_seconds:          # Alert if > 2x baseline
backup_age_minutes:               # Alert if not updated >= 25 hours
backup_success_count:             # Rate should be >= 1 per 24h
backup_failure_count:             # Alert if > 0

# WAL Archiving Metrics
wal_archive_delay_seconds:        # Alert if > 300 seconds (5 min)
wal_archive_backlog_bytes:        # Alert if > 1GB
wal_files_archived_count:         # For rate tracking

# Storage Metrics
s3_bucket_size_bytes:             # Track for cost optimization
s3_replication_status:            # Monitor cross-region replication
backup_encryption_key_age_days:   # Alert if > 90 days (before rotation)

# Recovery Tracking
recovery_time_estimate_seconds:   # Track RTO vs. 4-hour target
last_successful_restore_test:     # Alert if > 30 days (missing monthly drill)
```

### 5.3 Prometheus/AlertManager Configuration

```yaml
# prometheus-rules.yml
groups:
  - name: backup_alerts
    interval: 60s
    rules:
      # Alert: No backup in last 25 hours
      - alert: BackupStaleness
        expr: (time() - backup_last_completion_time) / 3600 > 25
        for: 15m
        labels:
          severity: critical
        annotations:
          summary: "No backup for {{ $value | humanizeDuration }}"
          
      # Alert: Backup job failed
      - alert: BackupJobFailure
        expr: increase(backup_failures_total[1h]) > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Backup job failed in last hour"
          
      # Alert: WAL archive backlog
      - alert: WALArchiveBacklog
        expr: pg_wal_archive_backlog_bytes > 1073741824  # 1GB
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "WAL archive backlog: {{ $value | humanize }}B"

# alertmanager-config.yml
receivers:
  - name: backup_alerts
    pagerduty_configs:
      - service_key: ${PAGERDUTY_SERVICE_KEY}
    slack_configs:
      - api_url: ${SLACK_WEBHOOK_URL}
        channel: '#database-alerts'
```

---

## 6. Disaster Recovery Testing

### Quarterly DR Drill
Schedule 4x/year:
1. **Full recovery test**: Restore full DB from backup to staging
2. **PITR test**: Recover to specific time from 1 week ago
3. **Replica failover test**: Trigger failover, test read/write
4. **Application validation**: Run integration tests against recovered DB
5. **Document findings**: Update runbooks if issues found

### DR Runbook Template
```markdown
# Disaster Recovery Runbook

## Full Database Recovery
**Step 1:** Verify backup availability & integrity
**Step 2:** Notify stakeholders & start incident response
**Step 3:** [commands from section 3.1]
**Step 4:** Validate data completeness
**Step 5:** Resume application traffic
**Step 6:** Post-incident review

**Emergency contacts:** [list of DBA, DevOps leads]
**Estimated duration:** 15-45 minutes
**Last tested:** [date]
```

---

## 7. Specific Concerns & Solutions


### 7.1 Large Tables (> 10GB)
- Use `pg_dump --jobs` for parallel export/import
- Partition large tables by date/range for faster reload
- Use incremental `COPY FROM STDIN` if doing custom restore

### 7.2 Encryption Key Recovery
- Store encryption_key backup separately in secure vault (e.g., HashiCorp Vault)
- Never co-locate backup data with encryption keys
- Require multi-person approval for key access

### 7.3 Replication Slot Cleanup
- Monitor replication lag: `SELECT * FROM pg_stat_replication;`
- Alert if lag > 1GB: indicates potential disaster recovery delays
- Cleanup abandoned slots via: `SELECT pg_drop_replication_slot('slot_name');`

### 7.4 SQLite Offline Cache (Desktop App)
- Validate checksums on startup: `PRAGMA integrity_check;`
- Auto-rebuild cache if corruption detected: `VACUUM; ANALYZE;`
- Implement periodic snapshot export for user data recovery

### 7.5 S3 Security Controls
If using S3 for backup storage, enforce the following:

- Public access to bucket is BLOCKED (block public ACLs and policies)
- Versioning is ENABLED on all backup buckets
- Cross-region replication is ENABLED for geo-redundancy
- IAM policy for backup access is scoped to backup role only (least privilege)
- S3 bucket policy enforces TLS and denies unencrypted uploads

### 7.6 License Server Backup & Recovery
- Activation records and license keys are backed up separately from main DB
- License server backup is encrypted and stored in a separate S3 prefix or vault
- Recovery procedure for license server is documented and tested quarterly
- Offline grace period and SLA are documented

### 7.7 SQLite Sync Conflict Resolution
- Define sync conflict strategy: **server-wins** (default) or manual merge for critical data
- All sync overwrite events are logged for audit trail
- After restore, sync engine checks for divergence and triggers conflict handler

---

## 10. Backup & DR Checklist (Sprint 1)

#### General
- [ ] RTO/RPO targets defined and approved by stakeholders
- [ ] Backup encryption at rest and in transit
- [ ] Encryption keys managed via secrets manager

#### PostgreSQL
- [ ] pg_basebackup as primary (PITR-compatible)
- [ ] pg_dump as supplementary logical backup
- [ ] Backup automation via pgBackRest or Barman
- [ ] Backup failure alerting configured
- [ ] Backup staleness alert (> 25 hours)
- [ ] Monthly restore drill with sign-off log
- [ ] S3 bucket: public access blocked, versioning enabled, cross-region replication, IAM-scoped policy

#### SQLite
- [ ] Sync conflict resolution strategy defined (server-wins vs. manual merge)
- [ ] Sync overwrite events logged for audit trail

#### License Server
- [ ] Activation records and license keys backed up separately
- [ ] Recovery procedure documented

---

## Sprint Planning & Recommendations

**Labels:** infrastructure, devops, security, sprint-1

**Recommendation:** Consider splitting PostgreSQL backup automation (pgBackRest/Barman, S3, alerting) into a separate sub-task/issue for Sprint 1 to keep scope manageable.

---

## 8. Compliance & Auditing

### Backup Logs
```sql
CREATE TABLE backup_audit_log (
  id SERIAL PRIMARY KEY,
  backup_id UUID,
  backup_time TIMESTAMP,
  backup_size_bytes INT,
  status VARCHAR(20), -- SUCCESS, FAILED
  retention_days INT,
  storage_location TEXT,
  verified_at TIMESTAMP,
  verified_by VARCHAR(255),
  notes TEXT
);
```

### Retention Policy
- Production backups: 30 days minimum (regulatory requirement varies)
- Compliance backups: 1+ years (archive to cold storage tier)
- Deletion: Cryptographic erasure (delete encryption key) after retention expires

---

## 9. Cost Optimization

- **S3 tiering**: Move backups > 90 days to Glacier Deep Archive (~$0.00099/GB/month)
- **Compression**: 9x compression reduces storage ~85% (from 100GB → 15GB)
- **Deduplication**: WAL-E/PgBackRest deduplicates common blocks across backups
- **Estimated monthly cost**: ~$50-200 depending on database size & retention

---

## Summary

| Component | Strategy | RTO | Detail |
|-----------|----------|-----|--------|
| Full DB | Daily dump → S3 | 45 min | `pg_dump --format=custom` |
| Incremental | Continuous WAL archive | 1 min | WAL-E / PgBackRest |
| PITR | WAL-based recovery | 30 min | Recover to any second |
| HA/Failover | Multi-AZ RDS replication | 30 sec | Automatic with Patroni |
| Testing | Quarterly DR drill | N/A | Validate runbooks |

---

**Last updated**: 2025-03-22  
**Next review**: 2025-06-22
