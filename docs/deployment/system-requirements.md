# System Requirements

## Supported operating systems
- Windows 10 22H2 or newer, 64-bit only
- Windows 11 23H2 or newer, 64-bit only
- macOS 13 Ventura or newer

## Minimum hardware
- CPU: 4 logical cores
- RAM: 8 GB
- Storage: 2 GB free disk space for install, logs, and local cache
- Network: Broadband internet for license activation and update delivery

## Recommended hardware
- CPU: 8 logical cores
- RAM: 16 GB
- Storage: SSD with 10 GB free space
- Display: 1920x1080 or higher

## Runtime dependencies
- Node.js 20+ for build agents only
- No local database server required for desktop deployment
- TLS 1.2+ outbound access to licensing API and update host

## Security prerequisites
- Corporate endpoint policy must allow signed Electron applications
- SSL inspection exceptions may be required for the update host if latest.yml downloads are blocked
- Windows SmartScreen reputation improves only after EV-signed releases are shipped consistently
