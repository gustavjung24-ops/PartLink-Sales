# 5 Critical Decisions - Quick Checklist
**Meeting Date**: [TBD]  
**Attendees**: PM, Tech Lead, [Stakeholders]  
**Duration**: 30-45 minutes

---

## Quick Decision Checklist

### ✅ Q1: Company Can Order — Pick ONE

- [ ] **A: Auto-detect via ERP** (product orderable status pulled real-time from ERP system)
  - Requires ERP integration module in MVP
  - Higher implementation complexity
  - More accurate, real-time data

- [ ] **B: Admin manually configures** (admin marks products orderable per company in UI)
  - No ERP integration needed
  - Lower complexity
  - Manual management burden

**CHOSEN**: ___________  
**Tech Impact**: Affects `product_availability.availability_type` enum

---

### ✅ Q2: Inventory & Price Sync — Pick ONE

- [ ] **A: Real-time from ERP** (continuous webhook/polling)
  - Requires ERP integration module
  - High complexity
  - Most accurate

- [ ] **B: Periodic CSV/Excel upload** (daily/weekly batch import)
  - Light integration, admin UI for uploads
  - Medium complexity
  - Good enough for most businesses

- [ ] **C: Manual entry in app** (users update quantities/prices manually)
  - UI changes only
  - Low complexity
  - High manual overhead

**CHOSEN**: ___________  
**Tech Impact**: Determines if ERP module in MVP; affects API endpoints & desktop handlers

**Follow-up**: If option A or B, what's acceptable staleness? 
- [ ] 5 minutes | [ ] 1 hour | [ ] 1 day | [ ] Other: ______

---

### ✅ Q3: 12 Industries — Provide COMPLETE LIST

**Format**: `Industry Name | Min Fields | Special Logic`

| # | Industry | Fields | Notes |
|---|----------|--------|-------|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |
| 8 | | | |
| 9 | | | |
| 10 | | | |
| 11 | | | |
| 12 | | | |

**Tech Impact**: Determines `industry_attribute_defs` seeding in migrations

---

### ✅ Q4: Quote Templates — Provide COUNT & LAYOUT

**Number of templates**: _______ (typically 1-5)

**Do templates need company-specific customization?**
- [ ] No (global only)
- [ ] Yes (per company)

**Which elements are customizable?**
- [ ] Logo/branding
- [ ] Payment terms
- [ ] Footer text
- [ ] Currency
- [ ] Other: ________________________

**PDF export preferred method?**
- [ ] PDFKit (lightweight, fast)
- [ ] Puppeteer (high fidelity, slower)

**Tech Impact**: Affects `quote_templates` schema & PDF export pipeline

---

### ✅ Q5: Offline Grace Period & Pricing — Pick OPTIONS

**How long can app work offline?**
- [ ] 24 hours
- [ ] 48 hours
- [ ] 72 hours
- [ ] No offline support
- [ ] Other: _______ 

**Should prices be visible when offline?**
- [ ] Yes (show cached prices)
- [ ] No (hide prices until online)
- [ ] Only within grace period (then hide)

**Can users create quotes while offline?**
- [ ] Yes (auto-sync when reconnected)
- [ ] No (blocked after grace period)
- [ ] Only within grace period

**Tech Impact**: Affects license key policy table, offline cache schema, UX

---

## Decision Recording

Once all are chosen, copy this section & commit to `/docs/SPRINT1_DECISIONS_FINAL.md`:

```
## Final Decisions (Approved: [DATE])

**Q1**: Option ___ (Company Can Order)
**Q2**: Option ___ (Inventory Sync) | Staleness: _____
**Q3**: 12 Industries seeded: [Confirmed by: ________]
**Q4**: Templates: _____ | Customizable: [Yes/No]
**Q5**: Offline grace: _____ | Show prices: [Yes/No] | Create quotes: [Yes/No]

Approved by:
- [ ] Product Manager: _____________ Date: _____
- [ ] Tech Lead: __________________ Date: _____
- [ ] Stakeholder: ________________ Date: _____

Ready for Sprint 1 kickoff: [ ] YES / [ ] NO
```

---

## What Happens Next?

**Immediately after decisions are made**:

1. Tech Lead updates schemas & migrations based on answers
2. API layer adds/removes endpoints
3. Desktop app configured with new IPC handlers
4. Offline sync scope finalized
5. Sprint 1 backlog prioritized

**If any decision is incorrect**, it requires:
- Database migration (data loss risk)
- API contract change (client renegotiation)
- UX redesign

**Therefore**: Take time to get these right. Better 2 hours of discussion now than 2 days of rework later.

