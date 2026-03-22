# Sprint 1 Decisions — Technical Impact Map
**Audience**: Tech Lead + Backend/Frontend Engineers  
**Purpose**: Understand schema, API, and UI changes per decision combo

---

## Decision Impact Matrix

### Scenario 1: Q1=A, Q2=A (Auto-ERP + Real-time Sync)
**Complexity**: 🔴 VERY HIGH | **MVP Scope**: ERP module REQUIRED | **Timeline**: 3+ sprints

#### Database Changes
```sql
-- NEW: ERP sync tracking
CREATE TABLE erp_sync_jobs (
  id UUID PRIMARY KEY,
  job_type ENUM('INVENTORY', 'PRICING', 'AVAILABILITY'),
  status ENUM('PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED'),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  records_processed INT
);

-- MODIFIED: product_availability (add ERP source tracking)
ALTER TABLE product_availability 
ADD COLUMN availability_type ENUM('ERP_REAL_TIME', 'ADMIN_CONFIGURED'),
ADD COLUMN erp_last_sync_at TIMESTAMP,
ADD COLUMN erp_status_raw JSONB;

-- NEW: inventory_audit_log (track changes)
CREATE TABLE inventory_audit_log (
  id UUID PRIMARY KEY,
  product_id UUID,
  quantity_before INT,
  quantity_after INT,
  changed_by ENUM('ERP_SYNC', 'USER_ACTION'),
  changed_at TIMESTAMP DEFAULT NOW()
);

-- NEW: price_history (track pricing over time)
CREATE TABLE product_price_history (
  id UUID PRIMARY KEY,
  product_id UUID,
  old_price DECIMAL(10,2),
  new_price DECIMAL(10,2),
  changed_by ENUM('ERP_SYNC', 'ADMIN'),
  changed_at TIMESTAMP DEFAULT NOW()
);
```

#### API Changes
```typescript
// NEW: /api/erp/webhooks/inventory-updated (webhook receiver)
POST /api/erp/webhooks/inventory-updated
{
  "eventType": "inventory_change",
  "products": [
    { "skuId": "...", "quantity": 500, "warehouseId": "..." }
  ]
}

// NEW: GET /api/products/:id/sync-status
{
  "available": true,
  "source": "erp",
  "lastSyncedAt": "2026-03-22T14:30:00Z",
  "staleness": "fresh"
}

// MODIFIED: GET /api/products (add ERP freshness metadata)
{
  "products": [...],
  "erpSyncStatus": "success",
  "erpLastSyncAt": "2026-03-22T14:30:00Z"
}
```

#### Desktop App Changes
```typescript
// NEW: src/main/services/erpSync.ts
class ERPSyncService {
  async syncInventoryAndPrices(): Promise<void> { ... }
  async handleWebhookUpdate(event): Promise<void> { ... }
}

// NEW: IPC handler
ipcMain.handle('erp:trigger-sync', async () => {
  await erpSyncService.syncInventoryAndPrices();
});

// NEW: preload bridge
electronApi.erp = {
  triggerSync: () => ipcInvoke('erp:trigger-sync'),
  onSyncStatusChanged: (cb) => ipcOn('erp:sync-status-changed', cb)
};

// NEW: src/renderer/hooks/useERPSync.ts
export function useERPSync() {
  const [syncStatus, setSyncStatus] = useState('idle');
  
  useEffect(() => {
    electronApi.erp.onSyncStatusChanged((status) => {
      setSyncStatus(status);
    });
  }, []);
  
  return { syncStatus, triggerSync: electronApi.erp.triggerSync };
}
```

#### Sprint 1 Blockers
- [ ] ERP API credentials management (vault? env vars?)
- [ ] ERP schema mapping (which fields = quantity? price?)
- [ ] Network resilience (retry logic, exponential backoff)
- [ ] Webhook verification (signature validation)

---

### Scenario 2: Q1=A, Q2=B (Auto-ERP + CSV Import)
**Complexity**: 🟠 MEDIUM-HIGH | **MVP Scope**: Light ERP + CSV uploader | **Timeline**: 2-3 sprints

#### Database Changes
```sql
-- NEW: import jobs (CSV tracking)
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY,
  import_type ENUM('INVENTORY', 'PRICING'),
  uploaded_at TIMESTAMP,
  uploaded_by_user_id UUID,
  file_name VARCHAR(255),
  status ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'),
  records_processed INT,
  error_summary JSONB,
  imported_at TIMESTAMP
);

-- NEW: import_mappings (field mapping config)
CREATE TABLE import_field_mappings (
  id UUID PRIMARY KEY,
  import_job_id UUID,
  csv_column_name VARCHAR(255),
  target_field ENUM('PRODUCT_SKU', 'QUANTITY', 'PRICE', 'WAREHOUSE_ID'),
  transform_rule VARCHAR(255)  -- e.g., "multiply_by:1000"
);

-- MODIFIED: product_availability (reduced ERP columns)
ALTER TABLE product_availability 
ADD COLUMN availability_type ENUM('ADMIN_CONFIGURED', 'IMPORTED');

-- product_price_history (same as Scenario 1)
```

#### API Changes
```typescript
// NEW: POST /api/admin/imports/inventory
{
  "importType": "inventory",
  "file": File  // CSV file upload
}

// NEW: GET /api/admin/imports/:jobId/status
{
  "status": "processing",
  "recordsProcessed": 450,
  "totalRecords": 500,
  "errors": [
    { "rowNumber": 12, "message": "SKU not found" }
  ]
}

// MODIFIED: GET /api/admin/imports/history (list past imports)
{
  "jobs": [
    { "id": "...", "type": "inventory", "uploadedAt": "...", "status": "success" }
  ]
}
```

#### Desktop App Changes
```typescript
// NEW: src/renderer/pages/Admin/ImportCSV.tsx
export function ImportCSVPage() {
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState({});  // CSV column → target field
  
  async function handleImport() {
    // 1. Map CSV columns to database fields
    // 2. Upload to API
    // 3. Poll status until complete
    // 4. Show success/error summary
  }
  
  return (
    <div>
      <FileUpload onSelect={setFile} />
      <ColumnMapper onChange={setMapping} />
      <button onClick={handleImport}>Import</button>
    </div>
  );
}

// NO IPC changes needed (API-driven)
```

#### Sprint 1 Scope
- [ ] CSV uploader UI (Admin page)
- [ ] Field mapping configuration
- [ ] Validation & error handling
- [ ] Import history log
- [ ] No real-time ERP polling needed

---

### Scenario 3: Q1=A, Q2=C (Auto-ERP + Manual Entry)
**Complexity**: 🟡 MEDIUM | **MVP Scope**: Admin UI only | **Timeline**: 1-2 sprints

#### Database Changes
```sql
-- MINIMAL: Just track who changed what
CREATE TABLE inventory_audit_log (
  id UUID PRIMARY KEY,
  product_id UUID,
  quantity_before INT,
  quantity_after INT,
  changed_by_user_id UUID,
  changed_at TIMESTAMP DEFAULT NOW()
);

-- product_price_history for manual changes
```

#### API Changes
```typescript
// NEW: PATCH /api/products/:id/inventory
{
  "quantity": 1500,
  "warehouseId": "..."
}

// NEW: PATCH /api/products/:id/price
{
  "unitPrice": 29.99
}
```

#### Desktop App Changes
```typescript
// NEW: src/renderer/pages/Admin/InventoryEditor.tsx
// Editable grid: Product | Quantity | Warehouse | Action
// Inline edit → PATCH API call → optimistic update

// No IPC changes needed
```

#### Sprint 1 Scope
- [ ] Editable inventory grid
- [ ] Editable pricing grid  
- [ ] Audit log viewing
- [ ] Very fast to implement

---

### Scenario 4: Q1=B, Q2=B (Admin Config + CSV Import)
**Complexity**: 🟢 LOW-MEDIUM | **MVP Scope**: Minimal | **Timeline**: 1 sprint

#### Database Changes
```sql
-- Minimal changes
ALTER TABLE product_availability 
ADD COLUMN availability_type ENUM('ADMIN_CONFIGURED');

CREATE TABLE import_jobs (...);  -- Same as Scenario 2
```

#### API Changes
```typescript
// Admin config: PATCH /api/admin/products/:id/availability
{
  "orderable": true,
  "reason": "Stocked in US warehouse"
}

// CSV import: Same as Scenario 2
```

#### Desktop App Changes
```typescript
// Simple toggle: Product → Orderable (Yes/No)
// CSV uploader: Same as Scenario 2
```

---

### Scenario 5: Q1=B, Q2=C (Admin Config + Manual Entry)
**Complexity**: 🟢 LOW | **MVP Scope**: Minimal | **Timeline**: 1 sprint (fastest)

#### Database Changes
```sql
-- Minimal
ALTER TABLE product_availability 
ADD COLUMN availability_type ENUM('ADMIN_CONFIGURED');
```

#### API Changes
```typescript
// Admin toggles: PATCH /api/admin/products/:id/availability & PATCH /price
```

#### Desktop App Changes
```typescript
// UI: Toggle availability + Editable price/quantity grid
```

#### Why this is fastest
- No ERP integration
- No CSV parsing
- No async job tracking
- Pure CRUD operations

---

## Q3 Impact (Industries & Attributes)

**Regardless of Q1/Q2 decision**, Q3 requires:

```typescript
// scripts/seed-industries.sql
-- ALL 12 industries must be defined before quotes work
-- Each industry has specific attribute requirements

// Example:
INSERT INTO industries (id, name) VALUES 
  ('auto', 'Automotive'),
  ('aero', 'Aerospace'),
  // ... 10 more

INSERT INTO industry_attribute_defs (industry_id, attributes) VALUES
  ('auto', '{"min_qty": 500, "certifications": ["ISO9001", "IATF16949"]}'::jsonb),
  // ... matching each industry
```

**Risk**: If Q3 list is incomplete or changed mid-sprint → quote validation breaks

---

## Q4 Impact (Quote Templates)

**Fixed per decision**:
```typescript
// Migration: Insert N templates into quote_templates table
// N = answer to "how many templates?"

// If templates are customizable:
//   → Add UI: Template editor with WYSIWYG PDF preview
//   → Add API: POST /api/admin/quote-templates

// PDF export engine:
//   → If Puppeteer chosen: desktop app needs Chromium binary (50MB+)
//   → If PDFKit chosen: lighter, but less formatting control
```

---

## Q5 Impact (Offline & Pricing)

### Scenario A: 24h Grace + Show Cached Prices + Allow Quotes Offline
```typescript
// offlineStore.ts must track:
interface OfflineGracePeriod {
  lastNetworkTime: ISO8601;
  daysRemaining: number;
  pricesStale: boolean;
}

// License policy updated:
interface LicenseOfflinePolicy {
  gracePeriodDays: 1;  // 24h = 1 day
  pricesVisibleOffline: true;
  allowQuoteCreationOffline: true;
}

// Quote lockout logic:
function isQuoteCreationLocked(gracePeriodExpired: boolean): boolean {
  return gracePeriodExpired;  // Locked after 24h offline
}
```

### Scenario B: 48h Grace + Hide Prices + No Quotes After Grace
```typescript
interface LicenseOfflinePolicy {
  gracePeriodDays: 2;
  pricesVisibleOffline: false;  // Hide prices after grace
  allowQuoteCreationOffline: false;
}

// UX: After 48h offline, full lock-down
// User sees: "License expired. Reconnect to continue."
```

---

## Scaffolding Checklist Per Scenario

| Feature | Q1=A | Q1=B | Q2=A | Q2=B | Q2=C | Q5 offline |
|---------|------|------|------|------|------|-----------|
| ERP integration module | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Webhook receiver | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| CSV uploader | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Inventory editor UI | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Availability toggle | ✅ | ✅ | N/A | N/A | N/A | ❌ |
| Offline sync + cache | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Quote locking | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Risk: Unknown Decision = Implementation Stops

**If any answer is unclear on March 24**:

- Backend: Cannot design API contracts
- Desktop: Cannot design IPC handlers
- Migrations: Cannot be written
- Offline caching: Scope undefined

**Action**: Block Sprint 1 kickoff until all 5 are finalized.

