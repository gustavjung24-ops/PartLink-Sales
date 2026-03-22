# Troubleshooting

## Installation blocked on Windows
- Verify the installer is signed by `PartLink Team`
- Confirm the EV certificate has not expired
- Check whether endpoint protection quarantined the installer

## Gatekeeper blocks the app on macOS
- Confirm notarization completed successfully for the shipped artifact
- Verify the user downloaded the final signed `.dmg` or `.zip`, not an internal unsigned build

## Updates never appear
- Confirm the client can reach `SPARELINK_UPDATE_URL`
- Check that `latest.yml` exists and references the current installer name
- Verify staged rollout percentage is not excluding the device cohort

## License activation fails
- Confirm outbound HTTPS access to the licensing API
- Verify system clock is correct; large drift can invalidate the nonce flow
- Check whether the license has exhausted allowed activations

## App opens but data is stale
- Review sync connectivity to the backend
- Confirm local storage is writable for the signed application container
