# Development Guide

## Release engineering workflow
- Build desktop assets with `pnpm --filter @sparelink/desktop build`
- Produce installers with `node ./scripts/build-installer.js`
- Use `--unsigned` only for internal dry runs
- Keep release notes and changelog synchronized with the release package

## Source of truth
- Packaging config: `apps/desktop/electron-builder.json`
- Updater runtime: `apps/desktop/src/main/services/updater.ts`
- Build pipeline: `scripts/build-installer.js`
