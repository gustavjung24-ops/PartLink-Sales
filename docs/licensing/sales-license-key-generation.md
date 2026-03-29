# Sales License Key Generation Workflow

## Inputs required from sales
- Customer legal name
- Customer primary contact
- Contract term
- Number of allowed device activations
- Environment: production or pilot

## Fulfillment process
1. Sales submits a release request in the approved internal workflow
2. Operations validates contract and entitlement count
3. Authorized operator generates the license in the admin tooling or secure backend process
4. Operator records:
   - license key
   - customer identifier
   - term start and expiry
   - activation limit
5. Sales receives the customer-safe delivery package only after validation

## Control requirements
- Dual control for production enterprise licenses
- Audit log entry required for every generated key
- Revocation and reissue must reference the previous key in the CRM

## Internal script (for authorized ops)
Use this internal CLI in the API workspace to generate a license and store it in database.

Prerequisites:
- API environment variables are configured (at minimum DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY)
- Database is reachable from the API runtime

Command:

```bash
pnpm --filter @sparelink/api license:create -- --customerId CUST-001 --expiryDays 365 --maxActivations 3 --trial false
```

Arguments:
- --customerId: internal customer identifier (required)
- --expiryDays: number of valid days from now (required)
- --maxActivations: allowed device activations (optional, default from service)
- --trial: true/false for trial license mode (optional, default false)

Expected output includes:
- licenseKey (format: SL-YYYY-XXXX-XXXX-XXXX)
- status
- expiryDate
- maxActivations
