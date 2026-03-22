# Auto-Update Infrastructure

## Overview
SPARELINK Sales uses `electron-updater` with a generic provider. Production artifacts are published as static files together with `latest.yml`.

## Server requirements
- HTTPS-enabled static hosting
- Stable URL exposed through `SPARELINK_UPDATE_URL`
- Directory listing not required
- MIME types must support `.yml`, `.exe`, `.zip`, and `.dmg`

## Required artifacts per release
- Windows installer `.exe`
- macOS `.zip` and `.dmg`
- `latest.yml`
- Optional release notes `.md`

## Rollout strategy
- `SPARELINK_UPDATE_ROLLOUT_PERCENTAGE` controls staged rollout between 0 and 100
- Devices are deterministically bucketed using a machine identifier hash
- Start with 5%, then 25%, 50%, and finally 100% after smoke validation

## Upload flow
1. Build signed installer artifacts
2. Verify `latest.yml` references the correct SHA512 and filename
3. Upload artifacts to the static host path configured in `SPARELINK_UPDATE_URL`
4. Invalidate CDN cache if enabled
5. Trigger canary validation on an internal pilot cohort

## Failure handling
- Keep the previous release artifacts available for rollback
- Do not delete the previous `latest.yml` until canary validation passes
- If download telemetry shows abnormal failure rates, roll back by restoring the prior `latest.yml`
