#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${BACKUP_ROOT:-}" ]]; then
  echo "[verify-backup] BACKUP_ROOT is required" >&2
  exit 1
fi

latest_backup="$(find "${BACKUP_ROOT}/postgres/base" -type f -name '*.tar.gz' | sort | tail -n 1)"

if [[ -z "${latest_backup}" ]]; then
  echo "[verify-backup] No base backup found in ${BACKUP_ROOT}/postgres/base" >&2
  exit 1
fi

backup_name="$(basename "${latest_backup}" .tar.gz)"
manifest_path="${BACKUP_ROOT}/postgres/manifests/${backup_name}.sha256"

if [[ ! -f "${manifest_path}" ]]; then
  echo "[verify-backup] Missing checksum manifest: ${manifest_path}" >&2
  exit 1
fi

sha256sum --check "${manifest_path}"

if command -v pg_verifybackup >/dev/null 2>&1; then
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "${temp_dir}"' EXIT
  tar -xzf "${latest_backup}" -C "${temp_dir}"
  pg_verifybackup "${temp_dir}"
fi

echo "[verify-backup] Backup verification completed for ${latest_backup}"