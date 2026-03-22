#!/usr/bin/env bash
# notify-failure.sh — Send a backup failure alert via webhook or email.
# Called automatically by backup-base.sh and backup-logical.sh on failure.
#
# Environment variables (set via infra/backup/env.example):
#   BACKUP_ALERT_WEBHOOK  — Slack/Teams/PagerDuty webhook URL (optional)
#   BACKUP_ALERT_EMAIL    — Destination email address (optional, requires `mail`)
#   BACKUP_ALERT_FROM     — From address used when sending email
set -euo pipefail

script_name="${1:-unknown-backup}"
error_message="${2:-Backup failed with no additional details.}"
hostname="$(hostname -f 2>/dev/null || hostname)"
timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

payload="[SPARELINK BACKUP FAILURE] ${script_name} on ${hostname} at ${timestamp}: ${error_message}"

sent=0

if [[ -n "${BACKUP_ALERT_WEBHOOK:-}" ]]; then
  json_payload="$(printf '{"text":"%s"}' "${payload//\"/\\\"}")"
  if curl --silent --fail --max-time 15 \
       --header "Content-Type: application/json" \
       --data "${json_payload}" \
       "${BACKUP_ALERT_WEBHOOK}" >/dev/null 2>&1; then
    echo "[notify-failure] Webhook alert sent."
    sent=1
  else
    echo "[notify-failure] WARNING: Webhook alert delivery failed." >&2
  fi
fi

if [[ -n "${BACKUP_ALERT_EMAIL:-}" ]]; then
  if command -v mail >/dev/null 2>&1; then
    echo "${payload}" | mail \
      -s "[SPARELINK] Backup failure: ${script_name}" \
      ${BACKUP_ALERT_FROM:+-r "${BACKUP_ALERT_FROM}"} \
      "${BACKUP_ALERT_EMAIL}" && sent=1 || \
      echo "[notify-failure] WARNING: Email alert delivery failed." >&2
  else
    echo "[notify-failure] WARNING: 'mail' not available; email alert skipped." >&2
  fi
fi

if [[ "${sent}" -eq 0 ]]; then
  echo "[notify-failure] WARNING: No alert channel configured (BACKUP_ALERT_WEBHOOK or BACKUP_ALERT_EMAIL)." >&2
fi

exit 0
