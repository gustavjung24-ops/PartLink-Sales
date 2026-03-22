# Commercial Distribution and Code Signing

## Week 1 mandatory actions
1. Order a Windows EV code signing certificate immediately. Typical lead time is 4 weeks.
2. Enroll the production Apple Developer account and verify access to App Store Connect, Apple ID, app-specific password, and Team ID.
3. Reserve CI secrets storage for signing and notarization credentials.

## Windows signing requirements
- Preferred mode: EV token or HSM-backed signing attached to the release agent
- Supported build script inputs:
  - `WIN_CSC_LINK` or `CSC_LINK` for file-based certificate workflows
  - `SPARELINK_WINDOWS_SIGNING_MODE=ev-token` for hardware-token workflows
- Required verification after build:
  - Authenticode signature valid
  - Timestamp present
  - Publisher matches `PartLink Team`

## macOS signing requirements
- Required CI secrets:
  - `APPLE_ID`
  - `APPLE_APP_SPECIFIC_PASSWORD`
  - `APPLE_TEAM_ID`
- Hardened runtime and entitlements are configured in `apps/desktop/build/mac/`
- Notarization must be executed on every production artifact

## CI flow
1. Install dependencies with `pnpm install`
2. Run `pnpm --filter @sparelink/desktop type-check`
3. Run `node ./scripts/build-installer.js --win` or `--mac`
4. Validate signature and notarization output
5. Upload installers and update metadata to the release host

## Commercial release policy
- Unsigned builds are allowed only for internal QA and must use `--unsigned`
- Production releases must never be distributed without code signing
- Certificate material must never be committed into this repository
