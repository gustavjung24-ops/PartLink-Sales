# WebApp License Quickstart

Use this when license is managed by Google Apps Script Web App (check/activate flow).

## 1) Configure Desktop Environment

Set these variables for desktop main process:

- `LICENSE_WEBAPP_URL` = Google Apps Script `/exec` URL
- `LICENSE_API_KEY` = same value as Script Property `API_KEY`
- `LICENSE_APP_NAME` = `Partling-sale`

Example:

```env
LICENSE_WEBAPP_URL=https://script.google.com/macros/s/XXXXXXXXXXXXXXXX/exec
LICENSE_API_KEY=THL79_SECURE_KEY_2026_XYZ
LICENSE_APP_NAME=Partling-sale
```

## 2) Google Sheet Columns (fixed order)

1. A: Activation code
2. B: Status (blank | active | suspended)
3. C: Customer
4. D: Phone
5. E: Machine ID
6. F: Activated At (ISO 8601)
7. G: Software Name (`Partling-sale`)
8. H: Expires At (ISO 8601)

## 3) Runtime Behavior

- Activate call: `POST {LICENSE_WEBAPP_URL}?action=activate`
- Validate call: `POST {LICENSE_WEBAPP_URL}?action=check`

Desktop sends JSON body with:

- `apiKey`
- `activationCode`
- `machineId`
- `appName`

## 4) Status Mapping

- `OK` or `ACTIVE` => app allows access
- `BOUND_OTHER` => blocked, message: already used on another device
- `EXPIRED` => blocked, message: license expired
- `SUSPENDED` => blocked, message: temporarily suspended
- others => invalid code

## 5) Quick Test

1. Create one row in sheet with code in column A and expiresAt in column H.
2. Launch desktop app and activate with that code.
3. Reopen app and verify status remains ACTIVE on same machine.
4. Try same code on another machine and verify BOUND_OTHER.