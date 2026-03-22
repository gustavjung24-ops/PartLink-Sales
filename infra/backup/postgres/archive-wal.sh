#!/usr/bin/env bash
# archive-wal.sh — PostgreSQL WAL archive hook.
#
# Called by PostgreSQL archive_command with %p (wal path) and %f (wal file name).
# Encryption: when S3_KMS_KEY_ID is set, S3 uploads use SSE-KMS.
#             All AWS CLI calls use HTTPS (TLS) by default.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <wal-path> <wal-file-name>" >&2
  exit 1
fi

wal_source_path="$1"
wal_file_name="$2"

if [[ -z "${BACKUP_ROOT:-}" ]]; then
  echo "[archive-wal] BACKUP_ROOT is required" >&2
  exit 1
fi

archive_dir="${BACKUP_ROOT}/postgres/wal"
mkdir -p "${archive_dir}"

target_path="${archive_dir}/${wal_file_name}"
cp "${wal_source_path}" "${target_path}"

if [[ -n "${S3_BACKUP_URI:-}" ]]; then
  # Encrypt WAL segments at rest using SSE-KMS.  All S3 calls use HTTPS (TLS).
  s3_sse_args=("--sse" "aws:kms")
  if [[ -n "${S3_KMS_KEY_ID:-}" ]]; then
    s3_sse_args+=("--sse-kms-key-id" "${S3_KMS_KEY_ID}")
  fi
  aws s3 cp "${target_path}" \
    "${S3_BACKUP_URI}/wal/${wal_file_name}" \
    "${s3_sse_args[@]}"
fi