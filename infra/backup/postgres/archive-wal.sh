#!/usr/bin/env bash
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
  aws s3 cp "${target_path}" "${S3_BACKUP_URI}/wal/${wal_file_name}"
fi