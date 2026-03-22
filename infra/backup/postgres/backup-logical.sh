#!/usr/bin/env bash
# backup-logical.sh — Supplementary logical backup using pg_dump.
#
# Purpose:  Portable schema + data export for cross-version migrations,
#           partial table restores, and schema verification.
#           This is NOT a substitute for the physical base backup
#           (backup-base.sh + WAL archiving) that enables PITR.
#
# Encryption: when S3_KMS_KEY_ID is set, uploads use SSE-KMS.
#             All AWS CLI calls use HTTPS (TLS) by default.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "[backup-logical] Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

require_env BACKUP_ROOT
require_env DB_HOST
require_env DB_PORT
require_env DB_NAME
require_env DB_USER

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
logical_dir="${BACKUP_ROOT}/postgres/logical"
manifest_dir="${BACKUP_ROOT}/postgres/manifests"
log_dir="${BACKUP_ROOT}/postgres/logs"
dump_name="logical_${DB_NAME}_${timestamp}"
dump_path="${logical_dir}/${dump_name}.dump"
manifest_path="${manifest_dir}/${dump_name}.sha256"
log_path="${log_dir}/${dump_name}.log"

mkdir -p "${logical_dir}" "${manifest_dir}" "${log_dir}"

_on_failure() {
  local exit_code=$?
  local error_msg="pg_dump logical backup failed (exit ${exit_code}). Check log: ${log_path}"
  echo "[backup-logical] ERROR: ${error_msg}" >&2
  bash "${SCRIPT_DIR}/notify-failure.sh" "backup-logical.sh" "${error_msg}" || true
  exit "${exit_code}"
}
trap '_on_failure' ERR

{
  echo "[backup-logical] Starting logical backup at ${timestamp}"

  # Use custom format for fastest restore and parallel dump support.
  # pg_dump connects over TCP — PGPASSWORD or .pgpass provides credentials.
  # The PostgreSQL client enforces TLS when sslmode=require is set.
  PGSSLMODE="${PGSSLMODE:-require}" pg_dump \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --username="${DB_USER}" \
    --dbname="${DB_NAME}" \
    --format=custom \
    --compress=9 \
    --file="${dump_path}"

  sha256sum "${dump_path}" > "${manifest_path}"

  if [[ -n "${S3_BACKUP_URI:-}" ]]; then
    s3_sse_args=("--sse" "aws:kms")
    if [[ -n "${S3_KMS_KEY_ID:-}" ]]; then
      s3_sse_args+=("--sse-kms-key-id" "${S3_KMS_KEY_ID}")
    fi
    aws s3 cp "${dump_path}" \
      "${S3_BACKUP_URI}/logical/${dump_name}.dump" \
      "${s3_sse_args[@]}"
    aws s3 cp "${manifest_path}" \
      "${S3_BACKUP_URI}/logical/${dump_name}.sha256" \
      "${s3_sse_args[@]}"
  fi

  echo "[backup-logical] Completed successfully: ${dump_path}"
} 2>&1 | tee -a "${log_path}"
