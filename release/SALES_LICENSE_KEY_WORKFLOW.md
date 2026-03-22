# Sales License Key Workflow

## Objective
Provide a repeatable process for the sales team to request, receive, and track customer license keys without exposing backend secrets.

## Workflow
1. Sales submits entitlement request with contract reference
2. Operations validates contract term and seat count
3. Authorized operator generates the license key
4. Operator stores the audit reference and sends the key through the approved customer channel
5. Sales confirms customer receipt and schedules onboarding

## Required records
- Customer account ID
- Generated license key reference
- Activation limit
- Expiry date
- Responsible operator
- Delivery timestamp

## Do not do
- Do not email raw backend secrets
- Do not reuse a customer key for another account
- Do not bypass audit logging for urgent deals
