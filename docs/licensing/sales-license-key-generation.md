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

## Operator quick command (date-based expiry)
Use this command from repository root when PostgreSQL and API environment are available.

```bash
pnpm license:issue -- <customerId> <expiryDate:YYYY-MM-DD> <maxActivations> <isTrial>
```

Examples:

```bash
# One key for one machine, expires on 2026-12-31
pnpm license:issue -- CUST-ACME-001 2026-12-31 1 false

# Trial key for one machine, expires on 2026-06-30
pnpm license:issue -- CUST-PILOT-010 2026-06-30 1 true
```

Command output includes:
- LICENSE_KEY
- CUSTOMER_ID
- EXPIRES_ON
- EXPIRY_DAYS
- MAX_ACTIVATIONS
- IS_TRIAL
