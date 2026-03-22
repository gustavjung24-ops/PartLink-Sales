# API Documentation

## Included references
- Existing OpenAPI specification in `openapi.yaml`
- Desktop update server contract in `desktop-update-contract.md`
- Licensing and activation endpoints in the backend route modules

## Release engineering note
The desktop updater does not use the main API directly for binary delivery. It consumes static update metadata hosted at `SPARELINK_UPDATE_URL`.
