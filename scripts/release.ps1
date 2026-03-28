param(
  [string]$WebAppUrl = $(Read-Host "Paste Apps Script Web App URL (ends with /exec)"),
  [string]$ApiKey = $(Read-Host "API Key (e.g., THL79_SECURE_KEY_2026_XYZ)")
)

$ErrorActionPreference = "Stop"
Write-Host "`n== Partling-sale local pack =="

# 1) Env
$env:VITE_LICENSE_WEBAPP_URL = $WebAppUrl
$env:VITE_LICENSE_API_KEY = $ApiKey

# 2) Corepack / pnpm
try { corepack enable } catch { Write-Host "corepack already enabled" }

# 3) Install deps at repo root
Write-Host "Installing dependencies..."
pnpm install --frozen-lockfile

# 4) Build shared packages first (if any)
Write-Host "Building shared packages..."
pnpm -r --workspace-concurrency=1 --filter "./packages/**" build

# 5) Prebuild native modules for Electron
Write-Host "Installing Electron native prebuilds..."
pushd apps\desktop
npx electron-builder install-app-deps

# 6) Build desktop
Write-Host "Building desktop..."
pnpm build

# 7) Package Portable + NSIS
Write-Host "Packaging Portable..."
pnpm run package:portable
Write-Host "Packaging NSIS..."
pnpm run package
popd

# 8) Open dist folder
$dist = "apps\desktop\dist"
if (Test-Path $dist) { explorer $dist }
Write-Host "`nDone. Binaries in: $dist"
