# Sprint 1 Blocking Decisions Framework
**Status**: 🔴 BLOCKED — Awaiting stakeholder decisions  
**Owner**: Product Manager + Tech Lead  
**Deadline**: March 23, 2026 (before Sprint 1 kickoff)  
**Audience**: Decision makers should fill Section B; Tech team implements per decisions

---

## Context
These 5 decisions directly impact:
- Database schema design (cannot be changed mid-sprint without migration)
- API contracts (affects client integrations)
- MVP scope (determines ERP module requirement)
- UX workflows (affects feature prioritization)

**Process**: 
1. PM gathers business requirements (Section B)
2. Tech Lead validates technical feasibility (Section C)
3. Record decision in Section D
4. Tech team implements immediately

---

## Q1: "Company Can Order" Definition

### What needs to be clarified
**How does the system determine if a product is orderable for a specific company?**

| Option | Description | ERP Integration | Manual Setup | Complexity |
|--------|-------------|-----------------|--------------|-----------|
| **A: Auto-detect via ERP** | System reads "orderable" status real-time from ERP | ✅ Required | ❌ Not applicable | High |
| **B: Admin config** | Admin manually marks products orderable per company | ❌ Not needed | ✅ Admin UI | Low |

### Technical Impact

**Option A (Auto-ERP)**:
```sql
-- product_availability schema
CREATE TABLE product_availability (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL,
  company_id UUID NOT NULL,
  availability_type ENUM ('ERP_REAL_TIME', ...) -- ADD THIS VALUE
  synced_at TIMESTAMP,
  UNIQUE(product_id, company_id)
);

-- API Response
{
  "orderable": true,          // Pulled from ERP
  "lastCheckedAt": "2026-03-22T14:30:00Z",
  "source": "erp"
}
```

**Option B (Admin Config)**:
```sql
-- product_availability schema
CREATE TABLE product_availability (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL,
  company_id UUID NOT NULL,
  availability_type ENUM ('ADMIN_CONFIGURED', ...) -- ADD THIS VALUE
  configured_by_admin_id UUID,  -- ADD THIS
  UNIQUE(product_id, company_id)
);

-- API Response
{
  "orderable": true,          // From admin setting
  "source": "admin"
}
```

### Section B: Business Answer
**DECISION**: [ ] Option A (Auto-ERP) | [ ] Option B (Admin Config)

**Rationale**: _______________________________________________________________

**Notes**: ___________________________________________________________________

---

## Q2: Inventory & Price Synchronization

### What needs to be clarified
**How often and by what mechanism are inventory levels and prices updated in the system?**

| Option | Mechanism | Frequency | ERP Module Required | Complexity |
|--------|-----------|-----------|---------------------|-----------|
| **A: Real-time from ERP** | Webhook/API polling from ERP system | Continuous | ✅ Yes | High |
| **B: Periodic import** | Upload CSV/Excel or scheduled sync | Daily/Weekly | ❌ Light integration | Medium |
| **C: Manual entry** | Logged-in users input via UI | Ad-hoc | ❌ Not needed | Low |

### Technical Impact

**Option A (Real-time ERP)**:
```typescript
// Requires: ERP integration module in desktop app + API
// New service: apps/api/src/services/erpSync/
// Polling interval: SPARELINK_ERP_SYNC_INTERVAL_MS=300000 (5 min)
// Webhook endpoint: POST /api/webhooks/erp/inventory-update
// Schema changes: 
//   - inventory_audit_log table (track real-time updates)
//   - product_price_history table (historical pricing)

// Desktop IPC new handler:
ipcMain.handle('erp:trigger-sync', async () => {
  await erpSyncService.syncInventoryAndPrices();
})
```

**Option B (Periodic CSV/Excel)**:
```typescript
// Requires: CSV uploader in Admin UI
// New endpoint: POST /api/admin/imports/inventory-csv
// Schema minimal changes:
//   - import_jobs table (track upload history)
// File format: product_sku, quantity, price, warehouse_id

// Desktop UI new component:
// src/renderer/pages/Admin/ImportCSV.tsx
```

**Option C (Manual entry)**:
```typescript
// UI enhancement only: editable qty/price in product grid
// No new tables required
// Offline sync complexity: manual entries → local queue → sync on reconnect
```

### Section B: Business Answer
**DECISION**: [ ] Option A (Real-time ERP) | [ ] Option B (CSV/Excel) | [ ] Option C (Manual)

**Expected sync frequency**: ___________________________________________________

**Will pricing change mid-quote?**: [ ] Yes | [ ] No  
*If Yes: Need quote locking mechanism*

**Notes**: ___________________________________________________________________

---

## Q3: 12 Industry Classifications & Attributes

### What needs to be clarified
**Provide exact list of 12 industries and the specific fields that vary per industry**

### Current Schema
```sql
-- industry_attribute_defs (JSONB-based, flexible)
CREATE TABLE industry_attribute_defs (
  id UUID PRIMARY KEY,
  industry_id UUID NOT NULL REFERENCES industries(id),
  attributes JSONB NOT NULL,  -- e.g., {"min_qty": 50, "lead_time_days": 14}
  created_at TIMESTAMP DEFAULT NOW()
);

-- products table (stores industry-specific config)
CREATE TABLE product_industry_config (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL,
  industry_id UUID NOT NULL,
  min_order_qty INT,
  lead_time_days INT,
  additional_fields JSONB,  -- Industry-specific customizations
  UNIQUE(product_id, industry_id)
);
```

### Section B: Business Answer
**DECISION**: Provide complete list:

| # | Industry Name | Min Fields Required | Industry-Specific Logic |
|---|---------------|-------------------|-------------------------|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| ... | | | |
| 12 | | | |

**Example for "Automotive"**:
```json
{
  "min_order_qty": 500,
  "lead_time_days": 14,
  "certifications_required": ["ISO9001", "IATF16949"],
  "inspection_level": "AQL_0.65",
  "packaging_type": "automotive_standard"
}
```

**Industry-specific fields that MUST be collected before Sprint 1**:
- ___________________________________________________________________
- ___________________________________________________________________
- ___________________________________________________________________

**Seeding approach**:
```typescript
// scripts/seed-industries.ts
const INDUSTRIES = [
  { id: "auto", name: "Automotive", attributes: {...} },
  // ... 11 more
];
```

**Notes**: ___________________________________________________________________

---

## Q4: Quote (Quotation) Templates

### What needs to be clarified
**How many quote templates exist? What customization per template?**

### Current Schema
```sql
CREATE TABLE quote_templates (
  id UUID PRIMARY KEY,
  company_id UUID,  -- NULL = global template
  name VARCHAR(255),
  template_type ENUM ('STANDARD', 'BULK', 'CUSTOM'),
  layout_config JSONB,  -- PDF layout: logo, terms, payment methods, etc.
  created_at TIMESTAMP
);

CREATE TABLE quote_items (
  id UUID PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES quotes(id),
  product_id UUID NOT NULL,
  quantity INT,
  unit_price DECIMAL(10,2),
  discount_percent DECIMAL(5,2),
  total_price DECIMAL(10,2)
);
```

### Section B: Business Answer
**DECISION**: Number of templates: ____________

**Template list**:
| # | Template Name | PDF Layout | Customizable | Frequency |
|---|---------------|-----------|--------------|-----------|
| 1 | | | [ ] Yes [ ] No | |
| 2 | | | [ ] Yes [ ] No | |
| ... | | | [ ] Yes [ ] No | |

**Per-template variability**:
- Logo placement: [ ] Yes [ ] No
- Payment terms: [ ] Yes [ ] No
- Currency: [ ] Yes [ ] No
- Company-specific branding: [ ] Yes [ ] No
- Other: ___________________________________________________________________

**PDF export tool**: Should we use:
- [ ] PDFKit (Node.js, lightweight)
- [ ] Puppeteer (Chrome-based, high fidelity)
- [ ] LibreOffice (server-side, slow)

**Notes**: ___________________________________________________________________

---

## Q5: Offline Grace Period & Price Display

### What needs to be clarified
**How long can app function offline? Should prices be visible when offline?**

| Scenario | No Internet | Grace Period | After Grace | UX Behavior |
|----------|-------------|--------------|-------------|-------------|
| View products | ✅ Yes | N/A | N/A | Show cached data |
| View prices | ? | __ hours/days | ? | Show/hide prices? |
| Create quote | ✅ Yes | __ hours | ❌ Blocked? | Queue for sync? |
| Checkout | ❌ Never | N/A | N/A | Error message |

### Technical Impact

**Option 1: 24h grace period + show cached prices**
```typescript
// apps/desktop/src/renderer/stores/offlineStore.ts
// Add schema:
interface CachedProductData {
  id: UUID;
  sku: string;
  name: string;
  cachedPrice: Decimal;  // Last known price
  cachedAt: ISO8601;
  priceStalenessWarning: boolean;  // Show "⚠️ Price may be outdated"
}

// Grace period config:
const OFFLINE_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;  // 24 hours

// Offline behavior:
function canCreateQuoteOffline(lastNetworkTime: Date): boolean {
  return Date.now() - lastNetworkTime.getTime() < OFFLINE_GRACE_PERIOD_MS;
}
```

**Option 2: 48h grace period + hide prices offline**
```typescript
// Products visible, but prices hidden
// Show: "Prices unavailable offline. Reconnect to view pricing."
// After 48h offline → quotes blocked + full app locked

const OFFLINE_GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;

function shouldDisplayPrices(isOnline: boolean, gracePeriodExpired: boolean): boolean {
  return isOnline || !gracePeriodExpired;  // Always show prices online; offline only within grace
}
```

**Option 3: No offline grace period (always need internet)**
```typescript
// Desktop app cannot function offline at all
// Middleware blocks all navigation if offline
// Skip offline sync infrastructure in Sprint 1
```

### Offline License Key Validation
```typescript
// License validation must ALSO work offline:
// Interface LicenseOfflinePolicy {
//   gracePeriodDays: number;        // Q5 answer
//   pricesVisibleOffline: boolean;  // Q5 answer
//   allowQuoteCreationOffline: boolean;  // Derived from Q5
// }
```

### Section B: Business Answer

**DECISION**: 

Grace period: [ ] 24h | [ ] 48h | [ ] 72h | [ ] No offline support

Show prices when offline: [ ] Yes | [ ] No | [ ] Only within grace period

Can create quotes offline: [ ] Yes | [ ] No | [ ] Only within grace period

**Rationale**: _______________________________________________________________

**Offline user profile**: Typical user is:
- [ ] Field sales (frequent offline)
- [ ] Office-based (rarely offline)
- [ ] Mixed (unpredictable)

**Stale price tolerance**: After grace period expires, user can:
- [ ] Still create quotes (prices may be wrong)
- [ ] Cannot create quotes (app locked)
- [ ] See warning "prices may be 48h old"

**Notes**: ___________________________________________________________________

---

## Decision Submission Template

**Once all 5 questions are answered**, fill this and commit to `/docs/SPRINT1_DECISIONS_FINAL.md`:

```markdown
# Sprint 1 Final Decisions
**Decided by**: [PM Name] / [Tech Lead Name]  
**Date**: [YYYY-MM-DD]  
**Approved**: [Stakeholder signoff]

## Q1 Answer
Decision: Option [A/B]  
Rationale: [...]

## Q2 Answer  
Decision: Option [A/B/C]  
Rationale: [...]

## Q3 Answer
Industries (seeded):  
[Complete list]

## Q4 Answer
Templates: [Number]  
[List with customizations]

## Q5 Answer
Grace period: [Duration]  
Price visibility: [Yes/No/Conditional]  
Create quotes offline: [Yes/No/Conditional]

## Implementation Impact
- Schema migrations needed: [list]
- ERP module in MVP: [Yes/No]
- CSV import in MVP: [Yes/No]
- Offline persistence scope: [...]
- API endpoints to add: [list]
- Desktop UI new screens: [list]
```

---

## Timeline

| Date | Action | Owner |
|------|--------|-------|
| NOW | Distribute this document to stakeholders | PM |
| 23-03-2026 EOD | All 5 answers collected | PM + Tech Lead |
| 24-03-2026 AM | Tech feasibility review + schema design | Tech Lead |
| 24-03-2026 PM | Sprint 1 kickoff with decisions documented | Team |

---

## Next Steps

1. **PM Action**: 
   - Schedule meeting with stakeholders
   - Distribute this document
   - Collect answers by March 23 EOD

2. **Tech Lead Action**:
   - Review answers for feasibility
   - Flag any technical concerns
   - Prepare schema/API design based on decisions

3. **Tech Team Action**:
   - Implement immediately upon decision
   - Create schema migrations
   - Add endpoints/IPC handlers as needed

---

**Blocked until signatures**: 
- [ ] PM signed off on Section B answers
- [ ] Tech Lead validated feasibility  
- [ ] No Sprint 1 work can start without this

