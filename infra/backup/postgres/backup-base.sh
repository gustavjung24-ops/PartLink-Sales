#!/usr/bin/env bash
# backup-base.sh — Daily physical base backup using pg_basebackup.
#
# Encryption: when S3_KMS_KEY_ID is set, uploads use SSE-KMS.
#             All AWS CLI calls use HTTPS (TLS) by default.
#             pg_basebackup uses SSL when PGSSLMODE=require (default below).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

_on_failure() {
  local exit_code=$?
  local error_msg="Physical base backup failed (exit ${exit_code}). Check log: ${log_path}"
  echo "[backup-base] ERROR: ${error_msg}" >&2
  bash "${SCRIPT_DIR}/notify-failure.sh" "backup-base.sh" "${error_msg}" || true
  exit "${exit_code}"
}
trap '_on_failure' ERR

{
  echo "[backup-base] Starting physical base backup at ${timestamp}"

  # PGSSLMODE=require enforces TLS for the replication connection.
  PGSSLMODE="${PGSSLMODE:-require}" pg_basebackup \
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
    # Encrypt uploads at rest using SSE-KMS.  All S3 calls use HTTPS (TLS).
    s3_sse_args=("--sse" "aws:kms")
    if [[ -n "${S3_KMS_KEY_ID:-}" ]]; then
      s3_sse_args+=("--sse-kms-key-id" "${S3_KMS_KEY_ID}")
    fi
    aws s3 cp "${backup_path}" \
      "${S3_BACKUP_URI}/base/${backup_name}.tar.gz" \
      "${s3_sse_args[@]}"
    aws s3 cp "${manifest_path}" \
      "${S3_BACKUP_URI}/base/${backup_name}.sha256" \
      "${s3_sse_args[@]}"
  fi

  echo "[backup-base] Completed successfully: ${backup_path}"
} 2>&1 | tee -a "${log_path}"