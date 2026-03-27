# SPARELINK Restore Drill Log

Record every restore drill here. Each entry must be signed off by the performing engineer and a second reviewer before closing.

| Date       | Drill Type          | Environment | Backup Used              | Duration | RTO Met? | RPO Met? | Performed By | Reviewed By | Notes |
|------------|---------------------|-------------|--------------------------|----------|----------|----------|--------------|-------------|-------|
| YYYY-MM-DD | Full restore        | staging     | base_sparelink_YYYYMMDD… | HH:MM    | Yes/No   | Yes/No   | @handle      | @handle     |       |
| YYYY-MM-DD | PITR                | staging     | base_sparelink_YYYYMMDD… | HH:MM    | Yes/No   | Yes/No   | @handle      | @handle     |       |
| YYYY-MM-DD | Logical (pg_dump)   | staging     | logical_sparelink_YYYY…  | HH:MM    | Yes/No   | Yes/No   | @handle      | @handle     |       |

## Drill Schedule

| Cadence   | Drill Type                                          |
|-----------|-----------------------------------------------------|
| Weekly    | `verify-backup.sh` against newest base backup       |
| Monthly   | Full physical restore into staging + sign-off below |
| Quarterly | PITR drill + application smoke tests                |

## Sign-off Checklist (fill per drill)

- [ ] Latest base backup available and checksum verified
- [ ] Restore completed within RTO (PostgreSQL ≤ 4 hours; SQLite cache immediate)
- [ ] Data loss within RPO (PostgreSQL ≤ 1 hour of WAL; SQLite ≤ 1 sync cycle)
- [ ] Application smoke tests passed on restored instance
- [ ] Runbook updated if any step deviated from documented procedure
- [ ] Drill results committed to this log with date and signatures
