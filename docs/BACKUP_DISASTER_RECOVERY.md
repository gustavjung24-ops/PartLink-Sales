# Database Backup & Disaster Recovery Strategy

## Overview

SPARELINK implements a comprehensive backup and recovery strategy for PostgreSQL database with multiple layers of protection:

### RTO/RPO Targets
- **Recovery Time Objective (RTO)**: < 1 hour
- **Recovery Point Objective (RPO)**: < 15 minutes

---

## 1. Backup Strategy

### 1.1 Full Backup
- **Frequency**: Daily at 2:00 AM UTC
- **Retention**: 30 days
- **Method**: `pg_dump` with custom format (ideal for point-in-time recovery)
- **Location**: S3 bucket with encryption

```bash
# Full backup script
pg_dump -U ${DB_USER} -h ${DB_HOST} \
  --format=custom \
  --compress=9 \
  --jobs=4 \
  ${DB_NAME} > backup_$(date +%Y%m%d_%H%M%S).dump

# Upload to S3
aws s3 cp backup_*.dump s3://sparelink-backups/full/
```

### 1.2 Incremental Backups (WAL Archive)
- **Frequency**: Continuous via PostgreSQL WAL archiving
- **Method**: WAL-E or PgBackRest for managed WAL shipping
- **Retention**: 7 days of WAL files
- **Storage**: S3, with 99.999999999% durability

```sql
-- PostgreSQL WAL archiving configuration
-- In postgresql.conf:
wal_level = replica
max_wal_senders = 10
wal_keep_size = 1GB
archive_mode = on
archive_command = 'wal-e wal-push %p'
archive_timeout = 300
```

### 1.3 Point-in-Time Recovery (PITR)
- Enables recovery to any second within WAL retention period
- Combine full backup + subsequent WAL files

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
2. **Restore from latest full backup:**
   ```bash
   pg_restore -U ${DB_USER} -h ${DB_HOST} \
     --jobs=4 \
     backup_latest.dump
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

### Key Metrics
```yaml
backup_size_bytes:           # Alert if growth > 20%/day
backup_age_minutes:          # Alert if > 24 hours
wal_archive_delay_seconds:   # Alert if > 300 seconds
disk_space_used_percent:     # Alert if > 80% full
recovery_time_estimate:      # Track for RTO validation
```

### Prometheus Queries
```promql
# Last backup age
time() - pg_stat_file{path="backup_latest"}

# Backup frequency check
rate(pg_backup_count[24h]) >= 1

# WAL archive backlog
pg_wal_archive_backlog_bytes > 1GB
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
