# Sprint 1 Decision Workflow

## 📋 Decision Documents Index

Use these in order:

### 1. **Meeting Preparation** (30 min before meeting)
📄 [`../SPRINT1_MEETING_BRIEF.md`](../SPRINT1_MEETING_BRIEF.md)  
→ PM reads this to the team  
→ Covers 5 Qs in plain language with business context  
→ Shows impact without technical jargon

### 2. **Decision Gathering** (During 45-min stakeholder meeting)
📄 [`../SPRINT1_DECISIONS_CHECKLIST.md`](../SPRINT1_DECISIONS_CHECKLIST.md)  
→ Quick format for recording decisions  
→ Fill in checkboxes during meeting  
→ Fast, low-ceremony

### 3. **Decision Submission** (After meeting, same day)
📄 [`../SPRINT1_DECISIONS_FINAL.md`](../SPRINT1_DECISIONS_FINAL.md)  
→ Formal decision record  
→ Signatures/approvals required  
→ Version control commit point  
→ Source of truth for implementation

### 4. **Technical Impact Review** (Next morning, Tech Lead)
📄 [`../SPRINT1_TECHNICAL_IMPACT.md`](../SPRINT1_TECHNICAL_IMPACT.md)  
→ Deep technical consequences per decision combo  
→ Schema changes, API changes, UI changes  
→ Sprint 1 backlog implications  
→ Risk assessment

### 5. **Full Decision Briefing** (Stakeholders may want deep context)
📄 [`../SPRINT1_DECISION_BLOCKERS.md`](../SPRINT1_DECISION_BLOCKERS.md)  
→ Comprehensive Q&A framework  
→ Every option explained with technical details  
→ For stakeholders who need full context

---

## 🎯 Timeline & Owners

| Milestone | Date | Owner | Action |
|-----------|------|-------|--------|
| Schedule meeting | Now | PM | Send invite to: PM, Tech Lead, [Stakeholders] |
| Pre-read brief | Mar 23, 9am | All | Read `MEETING_BRIEF.md` (5 min) |
| **Decision meeting** | Mar 23, 10am-11am | PM + Tech Lead | Record answers in `CHECKLIST.md` |
| **Formal submission** | Mar 23, EOD | PM | Fill + commit `DECISIONS_FINAL.md` |
| Tech impact review | Mar 24, 9am | Tech Lead | Read `TECHNICAL_IMPACT.md`; flag risks |
| **Sprint 1 kickoff** | Mar 24, 2pm | All | Start building (no blockers!) |

---

## ✅ Definition of Done

All 5 Qs have answers AND:

- [ ] File `/docs/SPRINT1_DECISIONS_FINAL.md` completed
- [ ] All 4 signatures collected (PM, Tech Lead, Stakeholder, Tech Lead accepts)
- [ ] File committed to git with message: `decisions: Q1-Q5 finalized for Sprint 1`
- [ ] Tech Lead reviewed in `TECHNICAL_IMPACT.md` and flagged any risks
- [ ] Sprint 1 backlog updated per decisions
- [ ] No blockers remain

---

## 📞 If Questions Arise

**During preparation (Mar 22-23 morning)**:  
Stakeholder doesn't understand a Q?  
→ Read full explanation in `DECISION_BLOCKERS.md`

**During meeting (Mar 23, 10am)**:  
Debate over an option?  
→ Check technical implications in `TECHNICAL_IMPACT.md`  
→ Ask Tech Lead directly

**Before sprint (Mar 24 morning)**:  
Need to revise a decision?  
→ Too late (unless major blocker)  
→ Document as "Sprint 1 Follow-up"  
→ Handle after Sprint 1 starts

---

## 🎓 Decision Record Template

Once meeting concludes, the team should have:

```markdown
# SPARELINK Sprint 1 Decisions
## Date: 2026-03-23

**Q1 (Company Can Order)**: Option B (Admin Config)  
**Q2 (Inventory Sync)**: Option B (CSV Import)  
**Q3 (Industries)**: [Complete list of 12]  
**Q4 (Quote Templates)**: 3 templates, non-customizable  
**Q5 (Offline)**: 48h grace, hide prices after, no quotes after grace  

Approved by:
- PM: [Name] ✅
- Tech Lead: [Name] ✅  
- Stakeholder: [Name] ✅

Ready for Sprint 1: ✅ YES
```

---

## 🚀 No More Decisions Allowed After Sprint 1 Starts

Once 5 Qs are answered and Sprint 1 begins:

- ✅ Minor clarifications (e.g., "Which 3 templates exactly?") — OK
- ❌ Major scope changes (e.g., "Actually, we want ERP integration") — Not OK
- ❌ New requirements that break assumptions — Defer to Sprint 2

**Why**: Schema is locked. APIs are being built. Desktop code is in progress.  
Changing decisions now = rework = lost time.

---

## 📊 Health Check

**At Sprint 1 standup (Mar 25), ask**:

"Are we still aligned on the 5 decisions from Mar 23?"
- [ ] Yes (proceed normally)
- [ ] Mostly (note exceptions, handle next sprint)
- [ ] No (urgent re-alignment meeting)

