# Throttl CRM — Handoff Document

> **Current handoff.** For the live data flow and schema, see
> [`Data_Flow_and_Schema_Map.md`](./Data_Flow_and_Schema_Map.md). For prioritized
> implementation work, see [`Next_Steps.md`](./Next_Steps.md). For operator-facing
> UI/UX issues, see [`UI_UX_Workflow_Issues.md`](./UI_UX_Workflow_Issues.md).

This document is intended for future developers or AI agents picking up work on the Throttl CRM web application. It captures the architectural decisions made during the V2 redesign, the current state of the system, and the prioritized next steps.

## 1. Architectural Decisions & Rationale

The core philosophy of the V2 redesign was to treat the web application as a **thin interface layer** for workflow execution, rather than a general-purpose database editor.

### Leads-First Airtable Architecture
The current app uses a two-stage operational flow:
1. **Leads:** The working queue and in-campaign source of truth through initial outreach.
2. **Re-engagement Archive:** The permanent repository for leads that have completed a sequence or reached a terminal status.

**Rationale:** Keeping in-flight outreach on `Leads` avoids snapshot drift. Pushes update the existing Lead with Instantly IDs, campaign metadata, `Pipeline Status = In Campaign`, and `Initial Outreach Date`; the archive job later moves eligible records to `Re-engagement Archive`.

### Instantly as the Execution Engine
We rely entirely on Instantly for email sending, sequencing, and engagement tracking. The web app does not send emails.

**Rationale:** Instantly's API provides robust per-lead personalization via the `personalization` field and `custom_variables` object. We use a single `{{personalization_hook}}` variable per lead, sent both as lead `personalization` and as `custom_variables.personalization_hook`, so campaigns can render the approved hook without cloning campaign templates.

### No General Edit Forms
The original V2 intent was to avoid general edit forms for lead data (e.g., fixing a typo in a name or updating a company URL).

**Rationale:** The live app now exposes a lead detail editor for those corrections, but bulk cleanup should still happen directly in Airtable. The dashboard stays focused on higher-value workflow actions: writing the hook, approving the lead, pushing to Instantly, and generating nurture angles.

---

## 2. Current System State

The system is functional around the Leads-first model. The campaign editor, Lead Queue, lead detail page, In Campaign panel, and archive panel all exist. The former cross-table `Leads -> Active Outreach -> Archive` model is no longer used by the app.

### Lead Queue
- **Filtering:** Filter by ICP Fit, Industry, Revenue Band, and Hook Status.
- **Inline Editing:** Click any hook cell to edit the `{{personalization_hook}}` inline.
- **Campaign Assignment:** Assign selected or filtered leads to an Instantly campaign.
- **Batch Generation:** Generate hooks for selected leads or unhooked queue leads after campaign assignment. Generation uses each lead's assigned campaign template as context.
- **Bulk Push:** Select multiple approved leads and push them to an Instantly campaign in one action. Successful push updates the Lead in place and moves it out of the queue via `Pipeline Status = In Campaign`.

### Lead Detail / Personalization Workbench
- **AI Generation:** Uses DeepSeek to draft a hook based on scraped research insights and the assigned campaign's first email template.
- **Email Preview:** Clearly separates the hook variable from the generic campaign email and renders the real Instantly template with variables filled.
- **Lead Editing:** Lets operators fix names, company fields, source context, notes, and personalization inputs.
- **Push:** Pushes the Lead to Instantly using the assigned campaign or an explicit campaign ID.

### In Campaign Panel
- **Campaign Performance:** Pulls aggregated metrics (Open Rate, Reply Rate, Bounce Rate) per campaign directly from Instantly.
- **Engagement Sync:** Pulls opens, replies, and bounces from Instantly back to Leads.
- **Re-engagement Countdown:** Shows `Initial Outreach Date` and days until archive eligibility.
- **Sync Errors:** Shows missing outreach-date and sync failures inline.

### Archive Panel
- **AI Nurture Angles:** Generates three specific, non-salesy content angles per lead based on their research profile and archive reason.

### Automation (Vercel Cron)
- **Nightly Re-engagement Trigger:** Runs at 5 AM UTC to move Leads that hit `Initial Outreach Date + 21 days` or a terminal status to the Archive.
- **Engagement Sync:** Runs 3x per weekday to sync engagement data from Instantly to Leads.

---

## 3. Known Gaps & Next Steps

The following features were identified as high-value additions but were not implemented in the V2 redesign. They should be prioritized in future development cycles.

### 1. Airtable Field Backfill
**Current State:** `Initial Outreach Date` exists on live `Leads` as a `dateTime` field. No backfill was performed.
**Next Step:** Backfill it only for existing `In Campaign` Leads that were pushed before the field existed.

### 2. Rehydrate After Server Actions
**Current State:** Bulk push returns updated Lead records and replaces local queue rows. Engagement sync and archive checks already write source-of-truth changes back to Airtable.
**Next Step:** Keep future server actions aligned with that same pattern so the UI can rehydrate from returned Airtable payloads when needed.

### 3. Finish the Lead Queue Refactor
**Current State:** Queue filtering/counts live in `useLeadQueue`, but actions, modals, and table rendering still live in `IngestionDashboard.tsx`.
**Next Step:** Extract `useLeadActions`, summary, filters, table, bulk action bar, and modal components. Keep server calls in one place.

### 4. Webhook Receiver for Instantly Events
**Current State:** Engagement data is synced via scheduled/manual polling.
**Next Step:** Build a webhook receiver endpoint (`POST /api/webhooks/instantly`) to receive real-time events and update the corresponding Lead immediately.

### 5. Re-engagement Campaign Push
**Current State:** The Archive panel generates AI nurture angles, but the user must manually enroll the lead in a new campaign in Instantly.
**Next Step:** Add a "Push to Nurture Campaign" button in the Archive panel. This would reuse the Lead Queue bulk-push mechanics, but point to a specific re-engagement campaign in Instantly, passing the chosen AI nurture angle as a custom variable.

### 6. Insights Scraper Integration
**Current State:** Research insights are assumed to be populated in Airtable via an external process (e.g., Apollo or a separate scraper).
**Next Step:** Add a "Scrape Insights" button to the Personalization Workbench that triggers a live scrape of the lead's LinkedIn profile or company website, summarizing the findings and writing them to the `Personalization Insights` field in Airtable.

### 7. Default Sorting in Lead Queue
**Current State:** Leads are sorted by the server query, then filtered in the client.
**Next Step:** Implement default sorting (e.g., by `Created Time` descending, or prioritizing leads with `High` ICP Fit) so the most relevant leads are always at the top of the queue.

---

## 4. Environment Variables

The system requires the following environment variables. Ensure these are set in Vercel before deploying any updates.

```env
# Airtable Configuration
AIRTABLE_API_KEY=...                 # Personal Access Token
AIRTABLE_PAT=...                     # Legacy alias supported by the code
AIRTABLE_BASE_ID=app...              # ThrottlGTM Base ID
AIRTABLE_LEADS_TABLE_ID=tbl...       # Leads table ID
AIRTABLE_ARCHIVE_TABLE_ID=tbl...

# Instantly Configuration
INSTANTLY_API_KEY=...                # Instantly API Key

# AI Configuration
DEEPSEEK_API_KEY=...                 # DeepSeek API Key (for hook generation)
DEEPSEEK_MODEL=deepseek-v4-flash     # Optional. Defaults to deepseek-v4-flash

# App Security
DASHBOARD_USERNAME=throttl
DASHBOARD_PASSWORD=...               # Basic Auth password for the web app
CRON_SECRET=...                      # Secret for Vercel Cron Jobs
```
