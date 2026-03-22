#!/usr/bin/env bash
set -euo pipefail

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "[restore-pitr] Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

require_env BACKUP_ROOT
require_env PGDATA

latest_backup="$(find "${BACKUP_ROOT}/postgres/base" -type f -name '*.tar.gz' | sort | tail -n 1)"
if [[ -z "${latest_backup}" ]]; then
  echo "[restore-pitr] No base backup found in ${BACKUP_ROOT}/postgres/base" >&2
  exit 1
fi

restore_command="${RESTORE_WAL_COMMAND:-cp ${BACKUP_ROOT}/postgres/wal/%f %p}"

if [[ -d "${PGDATA}" ]]; then
  find "${PGDATA}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
else
  mkdir -p "${PGDATA}"
fi

tar -xzf "${latest_backup}" -C "${PGDATA}"

cat > "${PGDATA}/postgresql.auto.conf" <<EOF
restore_command = '${restore_command}'
recovery_target_timeline = 'latest'
EOF

if [[ -n "${RECOVERY_TARGET_TIME:-}" ]]; then
  cat >> "${PGDATA}/postgresql.auto.conf" <<EOF
recovery_target_time = '${RECOVERY_TARGET_TIME}'
EOF
fi

touch "${PGDATA}/recovery.signal"

echo "[restore-pitr] Restored ${latest_backup} into ${PGDATA}"
echo "[restore-pitr] Start PostgreSQL on the standby host to replay WAL and complete recovery"