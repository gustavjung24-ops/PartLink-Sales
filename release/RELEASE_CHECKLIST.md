# Release Checklist

## Build verification
- [ ] `pnpm install` completed without dependency drift
- [ ] `pnpm --filter @sparelink/desktop type-check` passed
- [ ] `node ./scripts/build-installer.js --win` completed
- [ ] `node ./scripts/build-installer.js --mac` completed on macOS CI

## Signing and notarization
- [ ] Windows EV signing verified
- [ ] macOS notarization ticket stapled
- [ ] Publisher identity matches approved commercial entity

## Distribution
- [ ] Artifacts uploaded to update host
- [ ] `latest.yml` uploaded and validated
- [ ] Release notes linked to the customer-facing version
- [ ] Staged rollout percentage set for canary wave

## Go-live checks
- [ ] Smoke test installer on clean Windows machine
- [ ] Smoke test installer on clean macOS machine
- [ ] License activation validated against production backend
- [ ] Support team informed of rollout window and rollback plan
