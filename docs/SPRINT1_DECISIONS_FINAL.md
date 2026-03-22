# ⏳ Sprint 1 Final Decisions — AWAITING INPUT
**Status**: 🔴 BLOCKED (Pending stakeholder answers)  
**Due**: March 23, 2026 EOD  
**Decision Meeting**: [Schedule with PM + Tech Lead]

---

## Answer Template

**📋 Fill this out after stakeholder meeting & commit as source of truth**

---

## Q1: "Company Can Order" Definition

**CHOSEN**: [ ] Option A (Auto-ERP) | [ ] Option B (Admin Config)

**Rationale**:  
[Explain why this option was chosen]

---

## Q2: Inventory & Price Synchronization

**CHOSEN**: [ ] Option A (Real-time ERP) | [ ] Option B (CSV/Excel) | [ ] Option C (Manual Entry)

**Expected sync frequency** (if A or B):  
[ ] Every 5 minutes | [ ] Hourly | [ ] Daily | [ ] Weekly | [ ] Other: _____

**Will pricing change mid-quote?**: [ ] Yes | [ ] No  
*If Yes: Quotes will auto-lock prices upon creation*

**Rationale**:  
[Why this approach?]

---

## Q3: 12 Industry Classifications

**All 12 industries MUST be listed below** (Copy from stakeholder):

| # | Industry Name | Key Required Fields | Example Min Order Qty | Notes |
|---|---------------|-------------------|----------------------|-------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |
| 10 | | | | |
| 11 | | | | |
| 12 | | | | |

**Industry-specific attribute definitions** (JSONB):

```json
{
  "automotive": {
    "min_order_qty": 500,
    "lead_time_days": 14,
    "certifications": ["ISO9001", "IATF16949"],
    "inspection_level": "AQL_0.65"
  }
  // ... 11 more to be filled in ...
}
```

**Rationale**:  
[Why these 12? Any that can be added later?]

---

## Q4: Quote Templates

**Number of templates**: _____

**Template configurations** (Fill for each):

| Template Name | Description | Custom Fields | PDF Layout | Digital Only? |
|---------------|-------------|----------------|-----------|--------------|
| | | | | |
| | | | | |
| | | | | |

**PDF export technology chosen**:  
[ ] PDFKit (lightweight) | [ ] Puppeteer (high-fidelity) | [ ] Undecided

**Are templates editable by admins?**: [ ] Yes | [ ] No

**Rationale**:  
[Why this many templates? Can they be simplified?]

---

## Q5: Offline Grace Period & Pricing

**Offline grace period**: [ ] 24 hours | [ ] 48 hours | [ ] 72 hours | [ ] No offline support | [ ] Other: _____

**Show prices when offline?**: [ ] Always | [ ] Never | [ ] Only within grace period

**Allow quote creation when offline?**: [ ] Yes | [ ] No | [ ] Only within grace period

**Stale price tolerance after grace period expires**:  
- [ ] User can still create quotes (prices may be wrong)
- [ ] User cannot create quotes (app locked)
- [ ] Show warning "prices may be 2+ days old"

**Rationale**:  
[Typical user scenario? How often do they work offline?]

---

## Approval & Sign-Off

**Decision makers must sign this before Sprint 1 kickoff**:

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Manager | | | |
| Tech Lead | | | |
| Stakeholder / BA | | | |

**Notes from meeting**:  
[Any caveats, exceptions, or future considerations?]

---

## Tech Implementation Plan

**Once approved**, Tech Lead will create migration tasks:

### Q1 Implementation
- [ ] Schema: Update `product_availability.availability_type` enum
- [ ] API: Add/remove ERP endpoints
- [ ] Desktop: Configure availability toggle UI

### Q2 Implementation
- [ ] Schema: Create `import_jobs` table (if CSV) or sync tables (if ERP)
- [ ] API: Add inventory/pricing endpoints
- [ ] Desktop: Add uploader UI (if CSV) or editor grid (if manual)

### Q3 Implementation
- [ ] Schema: Insert all 12 industries into `industries` table
- [ ] Migrations: Seed `industry_attribute_defs`
- [ ] Validation: Add product-industry mapping checks

### Q4 Implementation
- [ ] Schema: Insert N templates into `quote_templates`
- [ ] PDF: Configure export engine (PDFKit vs Puppeteer)
- [ ] Desktop: Add template selector in quote creation

### Q5 Implementation
- [ ] Schema: Add `license_offline_policy` columns
- [ ] Desktop: Implement grace period countdown
- [ ] Offline sync: Configure cache persistence strategy
- [ ] Licensing: Enforce pricing visibility & quote creation rules

---

## Blockers Resolved?

- [ ] Q1 answered & impacts validated
- [ ] Q2 answered & ERP scope confirmed
- [ ] Q3 complete list provided
- [ ] Q4 templates finalized
- [ ] Q5 offline UX decided

**READY FOR SPRINT 1**: [ ] YES / [ ] NO

---

**If NO**: What's still unclear?  
[List remaining questions]

