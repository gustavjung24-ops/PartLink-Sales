# Desktop Update Contract

## Generic provider contract
The desktop client expects a static update feed compatible with `electron-updater` generic provider mode.

## Required endpoint layout
- `${SPARELINK_UPDATE_URL}/latest.yml`
- `${SPARELINK_UPDATE_URL}/SPARELINK Sales-<version>-win-x64.exe`
- `${SPARELINK_UPDATE_URL}/SPARELINK Sales-<version>-mac.zip`

## latest.yml requirements
- `version`
- `files[].url`
- `files[].sha512`
- `path`
- `sha512`
- `releaseDate`

## Runtime behavior
- Client checks for updates only when packaged
- Client suppresses rollout when its deterministic cohort falls outside `SPARELINK_UPDATE_ROLLOUT_PERCENTAGE`
- Download progress is surfaced in the renderer via the preload updater bridge
