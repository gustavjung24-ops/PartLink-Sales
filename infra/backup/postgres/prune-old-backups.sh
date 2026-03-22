#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${BACKUP_ROOT:-}" ]]; then
  echo "[prune-old-backups] BACKUP_ROOT is required" >&2
  exit 1
fi

retention_days="${BACKUP_RETENTION_DAYS:-30}"
wal_retention_days="${WAL_RETENTION_DAYS:-7}"

find "${BACKUP_ROOT}/postgres/base" -type f -mtime "+${retention_days}" -delete 2>/dev/null || true
find "${BACKUP_ROOT}/postgres/manifests" -type f -mtime "+${retention_days}" -delete 2>/dev/null || true
find "${BACKUP_ROOT}/postgres/logs" -type f -mtime "+${retention_days}" -delete 2>/dev/null || true
find "${BACKUP_ROOT}/postgres/wal" -type f -mtime "+${wal_retention_days}" -delete 2>/dev/null || true