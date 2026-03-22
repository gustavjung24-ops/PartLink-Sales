#!/usr/bin/env bash
set -euo pipefail

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "[backup-base] Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

require_env BACKUP_ROOT
require_env DB_HOST
require_env DB_PORT
require_env DB_NAME
require_env DB_USER

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
base_dir="${BACKUP_ROOT}/postgres/base"
manifest_dir="${BACKUP_ROOT}/postgres/manifests"
log_dir="${BACKUP_ROOT}/postgres/logs"
backup_name="base_${DB_NAME}_${timestamp}"
backup_path="${base_dir}/${backup_name}.tar.gz"
manifest_path="${manifest_dir}/${backup_name}.sha256"
log_path="${log_dir}/${backup_name}.log"

mkdir -p "${base_dir}" "${manifest_dir}" "${log_dir}"

{
  echo "[backup-base] Starting physical base backup at ${timestamp}"
  pg_basebackup \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --username="${DB_USER}" \
    --pgdata=- \
    --format=tar \
    --gzip \
    --wal-method=none \
    --label="sparelink-${timestamp}" \
    > "${backup_path}"

  sha256sum "${backup_path}" > "${manifest_path}"

  if [[ -n "${S3_BACKUP_URI:-}" ]]; then
    aws s3 cp "${backup_path}" "${S3_BACKUP_URI}/base/${backup_name}.tar.gz"
    aws s3 cp "${manifest_path}" "${S3_BACKUP_URI}/base/${backup_name}.sha256"
  fi

  echo "[backup-base] Completed successfully: ${backup_path}"
} 2>&1 | tee -a "${log_path}"