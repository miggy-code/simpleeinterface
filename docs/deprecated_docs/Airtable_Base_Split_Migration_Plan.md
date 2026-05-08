# Airtable Base Split: Migration Plan & Recommendation

> **✅ COMPLETED.** The split happened. The `ThrottlGTM` base
> (`appfS9ODVKZ2XEATW`) now contains only the 4 outreach tables: `Leads`,
> `Companies`, `Active Outreach`, `Re-engagement Archive`. The internal tables
> (`Meeting Notes`, `Performance Metrics`, `Projects`, `Goals Tracker`,
> `Coaching Notes`) moved to a separate `ThrottlInternal` base
> (`appZBVnpJImiNvIHM`). This document is kept as historical record of the
> migration plan. For the current GTM base schema, see
> [`Data_Flow_and_Schema_Map.md`](./Data_Flow_and_Schema_Map.md).

This document outlines the recommendation and migration plan for splitting the current `ThrottlGTM` Airtable base into two distinct bases: `ThrottlGTM` (for Go-To-Market and outreach) and `ThrottlInternal` (for post-meeting operations and internal tracking).

## 1. Recommendation: Does a split make sense?

**Yes, a split makes perfect sense.**

Currently, the `ThrottlGTM` base contains two entirely different operational domains:
1. **The Outreach Engine:** `Leads`, `Active Outreach`, `Re-engagement Archive`, `Companies`
2. **The Internal Operations Engine:** `Meeting Notes`, `Goals Tracker`, `Projects`, `Performance Metrics`, `Coaching Notes`

Keeping these in the same base creates several problems:
- **Clutter:** The base has 10 tables, making it difficult to navigate.
- **Security/Permissions:** If you ever hire a VA or SDR to manage the outreach queue, you likely do not want them having access to internal `Meeting Notes`, `Goals Tracker`, or `Performance Metrics`. Airtable permissions are managed at the base level, so splitting them is the only way to enforce this boundary.
- **API Performance:** The web app only needs access to the outreach tables. A smaller base means a lighter schema payload and less risk of hitting API rate limits from unrelated internal automations.

**The Boundary Line:** The handoff point between the two bases is the **Meeting**. Once a lead books a meeting, they transition from a "Lead" (GTM) to an "Opportunity/Client" (Internal).

---

## 2. The Target Architecture

### Base 1: ThrottlGTM (The Outreach Engine)
This base will be exclusively dedicated to top-of-funnel lead generation and outreach.
- `Leads` (Ingestion queue)
- `Active Outreach` (In-flight campaigns)
- `Re-engagement Archive` (Lead repository)
- `Companies` (Account-based tracking for outreach)

### Base 2: ThrottlInternal (The Operations Engine)
This base will handle everything that happens *after* a meeting is booked, plus internal company management.
- `Meeting Notes` (Transcripts, AI summaries, post-mortems)
- `Performance Metrics` (Deal tracking, opportunity scoring)
- `Projects` (Client deliverables, internal initiatives)
- `Goals Tracker` (Company OKRs)
- `Coaching Notes` (Internal team development)

---

## 3. Migration Plan (For the Next Thread)

Migrating tables between Airtable bases requires careful handling of linked records. Here is the step-by-step execution plan for the next developer or AI agent.

### Phase 1: Preparation
1. **Backup:** Export the entire `ThrottlGTM` base as a CSV/Excel backup before starting.
2. **Environment Variables:** Add `AIRTABLE_INTERNAL_BASE_ID=appZBVnpJImiNvIHM` to the `.env` file in the `emailinterface` repository.

### Phase 2: Schema Recreation in ThrottlInternal
Do not use CSV imports to move the tables, as this breaks linked records and attachment fields. Instead, use Airtable's native "Duplicate Table" feature or recreate them via the API.

Move the following tables to `ThrottlInternal`:
1. `Meeting Notes`
2. `Performance Metrics`
3. `Projects`
4. `Goals Tracker`
5. `Coaching Notes`

*Note: Because `Meeting Notes` currently links to `Leads` and `Companies` in the GTM base, you will need to decide how to handle that link. Airtable supports cross-base synced tables. The best approach is to create a Synced Table of `Companies` inside `ThrottlInternal` so the Meeting Notes can still link to the account.*

### Phase 3: Data Migration
1. Ensure all records in the 5 internal tables are successfully copied over to `ThrottlInternal`.
2. Verify that all attachment fields (like transcripts in `Meeting Notes`) transferred correctly.
3. Set up the cross-base sync for the `Companies` table if required.

### Phase 4: Codebase Updates
The `emailinterface` web app currently only interacts with the outreach tables (`Leads`, `Active Outreach`, `Archive`). Therefore, **the web app codebase does not need to change** as a result of this split, because it does not query the internal tables.

However, if there are any external scripts, Zapier automations, or Make.com workflows that interact with `Meeting Notes` or `Projects`, their Airtable connection nodes must be updated to point to the new `ThrottlInternal` base ID.

### Phase 5: Cleanup
Once data integrity is verified in `ThrottlInternal` and all external automations are repointed:
1. Delete the 5 internal tables from the `ThrottlGTM` base.
2. The `ThrottlGTM` base will now be a clean, 4-table outreach engine.

---

## 4. Summary for Gabe

Splitting the bases is the right move for security, scalability, and mental clarity. The migration is straightforward because the web app we just built only touches the GTM side. The next thread can execute this migration entirely within Airtable without needing to rewrite the web app's core logic.
