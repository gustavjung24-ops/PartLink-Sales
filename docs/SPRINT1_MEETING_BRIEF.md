# Sprint 1 Blocker Meeting — 5 Minute Brief
**Duration**: 30-45 minutes  
**Attendees**: PM, Tech Lead, [C-suite/Business stakeholders]  
**Goal**: Make 5 decisions to unblock Sprint 1 kickoff (March 24)

---

## 🎯 Why These 5 Questions Matter

Each decision affects:
- **Database schema** (data structure, can't easily change mid-sprint)
- **API contracts** (client integrations)
- **MVP scope** (what features in first version)
- **User experience** (desktop app behavior)

**If we guess wrong**, it means rework. **If we skip**, Sprint 1 can't start.

---

## ⚡ The 5 Questions (2 minutes each)

### 1️⃣ **How do we know what products are orderable?**

**Real-world scenario**: Salesman is on a call with a customer. Can he quote them product X?

**Option A**: System checks live with ERP → "Yes, orderable"  
✅ Always accurate  
❌ Needs ERP integration ($$$, complexity)

**Option B**: Admin manually marks in app → "Yes, orderable"  
✅ Simple to implement  
❌ Manual maintenance burden

**→ Which feels right for your business?**

---

### 2️⃣ **How do prices and inventory stay current?**

**Real-world scenario**: Price dropped in ERP system. When does salesman app see new price?

**Option A**: Real-time from ERP (every 5 min)  
✅ Always fresh  
❌ Complex integration, higher cost

**Option B**: Batch import daily/weekly (upload CSV)  
✅ Manageable, familiar process  
❌ Data lags behind reality

**Option C**: Sales team types prices manually  
✅ Fastest to build  
❌ Data entry errors, high overhead

**→ What's acceptable staleness? 1 hour? 1 day?**

---

### 3️⃣ **What are your 12 industry categories?**

**Why it matters**: Different industries have different rules (min order qty, lead times, certifications).

**Example**: Automotive might need ISO9001 certification; Medical might need FDA approval.

**Need**: Complete list of 12 + key fields per industry

**→ Can you provide this list today or tomorrow?**

---

### 4️⃣ **How many quote templates do you need?**

**Real-world scenario**: Customer A gets quotes with blue branding; Customer B gets green.

**Option A**: 1 global template (simple)  
**Option B**: 3-5 customizable templates (flexible)  
**Option C**: Each customer gets custom template (complex)

**Also**: PDF export — high-quality design (30% slower) or basic/fast?

**→ How many templates? Customizable by customer?**

---

### 5️⃣ **How long can salespeople work offline?**

**Real-world scenario**: Salesman is in field with no internet. Can he still create quotes?

**Option A**: Yes, for 24 hours (then locked)  
✅ Salespeople happy  
❌ Complex sync + stale data handling

**Option B**: Yes, for 48 hours (prices hidden after)  
✅ Compromise  
❌ UX complexity

**Option C**: No offline support at all  
✅ Simple  
❌ Salespeople can't work offline

**Also**: Should offline quotes show last-known prices? Or "prices unavailable"?

**→ How often are your salespeople offline? How long?**

---

## 📋 Quick Vote

Go around the room:

| Q | Vote | 
|---|------|
| Q1: Option A (ERP) or B (Admin)? | |
| Q2: Option A (Real-time), B (CSV), or C (Manual)? | |
| Q3: 12 industries list ready? [ ] Yes [ ] By tomorrow |
| Q4: # Templates? Customizable? | |
| Q5: Offline 24h/48h/never? Show prices? | |

---

## 🚀 What Happens Monday (March 24)

1. **Tech Team** implements schema & APIs per decisions
2. **Desktop App** adds new UI/IPC handlers
3. **Sprint backlog** reflects new requirements
4. **Everyone** starts coding

---

## ⚠️ If We Can't Decide Today

**Consequences**:
- Sprint 1 kickoff delayed
- Dev team blocked
- Timeline slips

**Better to decide 80% right now than delay a week.**

---

## 📝 After Meeting: Submit Answers Here

**Fill out**: `/docs/SPRINT1_DECISIONS_FINAL.md`  
**Sign off**: PM + Tech Lead + Stakeholder  
**Git commit**: `decisions: Q1-Q5 finalized for Sprint 1`

---

**Questions before we start?**

