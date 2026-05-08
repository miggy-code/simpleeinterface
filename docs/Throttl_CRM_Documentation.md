# Throttl CRM System Documentation

> **Current operator documentation.** The canonical schema and data flow live in
> [`Data_Flow_and_Schema_Map.md`](./Data_Flow_and_Schema_Map.md). Prioritized
> implementation gaps live in [`Next_Steps.md`](./Next_Steps.md).

This document explains how the Throttl CRM system works, how to use the web application, and how the underlying Airtable and Instantly integrations are structured.

The former `Active Outreach` snapshot table exists in Airtable but is not part of the app lifecycle.

## 1. System Architecture

The Throttl CRM uses `Leads` as the source of truth through initial outreach, with the web application acting as a thin interface layer for workflow execution. Instantly handles all email sending and engagement tracking.

### The Tables

The `ThrottlGTM` Airtable base today has 4 tables. The current app lifecycle is `Leads -> Re-engagement Archive`; the former Active Outreach table is not used by the app. See `Data_Flow_and_Schema_Map.md` for full schema.

| Table | Purpose | Status |
|---|---|---|
| **Leads** (`tblfv5ljYNeAqz4WL`, 43 fields) | The entry point and working queue. | Active — has data |
| **Companies** (`tblsVx3KwDh9nA7HD`, 16 fields) | Account-level rollup; Leads link via `Company Link`. | Schema-only, empty |
| **Active Outreach** (`tblV5JazpXNARFbRW`, 30 fields) | Former snapshot table. | Unused by app |
| **Re-engagement Archive** (`tblg1X65XmCpOYh7Q`, 30 fields) | Permanent repository for completed or terminal outreach. | Active destination |

### The Interface Layer

The web application (`emailinterface`) is designed specifically for workflow execution. It is **not** a general-purpose database editor, but it does expose a full lead-detail editor for operator cleanup and quick fixes. High-volume raw data cleanup should still happen directly in Airtable. The web app is used for:
1. Reviewing and filtering the Lead Queue.
2. Writing and approving the `{{personalization_hook}}`.
3. Pushing leads to Instantly campaigns.
4. Monitoring active campaign performance.
5. Generating AI nurture angles for archived leads.

---

## 2. Core Workflows

### Phase 1: Lead Queue & Personalization

When new leads are added to the **Leads** table in Airtable by an external sourcing process, they appear in the **Lead Queue** tab of the web app.

1. **Filter the Queue:** Use the dropdowns at the top of the Lead Queue to filter by ICP Fit, Industry, Revenue Band, campaign assignment, and hook status.
2. **Assign a Campaign:** Assign leads to the Instantly campaign before generating hooks. The campaign's first email provides the context for whether `{{personalization_hook}}` should be a full sentence or a fragment.
3. **Write the Hook:** You can write the personalization hook in two ways:
   - **Inline:** Click the hook text directly in the table row to open a quick editor.
   - **Lead Detail:** Click **Open** to use the full Lead Detail / Personalization Workbench.
4. **Use Lead Detail:** The detail page provides the full context needed to personalize an email:
   - **Research Insights:** Read the scraped data about the lead.
   - **AI Generation:** Generate or regenerate a hook with DeepSeek after a campaign is assigned.
   - **Email Preview:** See the hook variable clearly separated from the actual Instantly campaign email with variables filled.
5. **Approve:** Once the hook is written, click **Approve**. The lead's status changes to `Approved`.

### Phase 2: Pushing to Instantly

You can push leads to Instantly individually from Lead Detail, or in bulk from Lead Queue.

**To bulk push:**
1. Check the boxes next to multiple `Approved` leads on Lead Queue.
2. Click **Push to Instantly**.
3. Select the target campaign from the dropdown.
4. Click **Push**.

**What happens under the hood:**
- The app creates the lead in Instantly via the API.
- It passes the hook through Instantly's lead `personalization` field and also stores it as `custom_variables.personalization_hook` for campaigns that use `{{personalization_hook}}`.
- It updates the existing **Leads** record with `Instantly Lead ID`, campaign fields, `Pipeline Status = In Campaign`, and `Initial Outreach Date`.

### Phase 3: In Campaign Monitoring

Once a lead is pushed, it appears in the **In Campaign** tab, which is a filtered view of Leads where `Pipeline Status = In Campaign`.

1. **Monitor Engagement:** This tab shows the current status of every lead in flight (Opened, Replied, Bounced, etc.).
2. **Campaign Performance:** Toggle the view in the top right to see aggregated performance metrics (Open Rate, Reply Rate, Bounce Rate) for each active campaign, pulled live from Instantly.
3. **Sync Data:** Click the **Sync engagement** button to pull the latest open/reply data into Leads. This also runs on the weekday cron.
4. **Check Archive Timing:** The table shows `Initial Outreach Date` and days until 21-day archive eligibility.
5. **Fix Sync Errors:** Any missing outreach date or sync failure appears in the Sync column.

### Phase 4: Re-engagement & Archiving

Leads do not stay in the initial outreach stage forever. They are moved from `Leads` to the Archive to keep the working table clean and to prepare them for future nurture campaigns.

1. **The 21-Day Rule:** If `Initial Outreach Date + 21 days` has been reached, the lead is considered finished with the sequence unless it is a win.
2. **Trigger the Archive:** Click the **Run re-engagement check** button. The system scans Leads with `Pipeline Status = In Campaign`.
3. **What happens under the hood:**
   - Leads that booked a meeting or replied positively stay in Leads for operator follow-up.
   - Leads that bounced or unsubscribed are moved to the Archive immediately.
   - Leads with `Initial Outreach Date + 21 days` reached are moved to the Archive.
   - Leads missing `Initial Outreach Date` remain in Leads and get a `Sync Errors` message.

### Phase 5: The Archive & Nurture Angles

The **Archive** tab is your permanent lead repository. It shows the final outcome and archive reason for every lead.

1. **Generate Nurture Angles:** Click any row in the Archive to expand it.
2. The app will automatically use AI to generate three specific, non-salesy content angles (e.g., a blog post topic, a case study idea) tailored to that specific lead's industry and original research profile.
3. Use these angles to manually enroll the lead in a new, highly targeted re-engagement campaign in Instantly.

---

## 3. Maintenance & Automation

To keep the system running smoothly, the following automations should be configured:

### 1. Nightly Re-engagement Cron Job
Runs through Vercel Cron and can also be run manually from the dashboard.
- **Endpoint:** `GET /api/cron/reengagement` for cron, `POST /api/reengagement/trigger` for manual dashboard use.
- **Behavior:** Scans Leads where `Pipeline Status = In Campaign`, archives terminal leads immediately, archives non-wins after `Initial Outreach Date + 21 days`, and writes `Sync Errors` when the outreach date is missing.

### 2. Hourly Engagement Sync
Runs through Vercel Cron and can also be run manually from the dashboard.
- **Endpoint:** `GET /api/cron/sync-engagement` for cron, `POST /api/engagement/refresh` for manual dashboard use.
- **Behavior:** Scans Leads where `Pipeline Status = In Campaign` and `Instantly Lead ID` exists, then updates engagement fields on Leads.

### 3. Airtable View Management
The web app relies on the Airtable API, which does not support programmatic view creation. If you ever recreate the Leads table, you must manually create the following views to keep the Airtable UI organized:
- `01 - Lead Queue`
- `02 - Needs Approval`
- `03 - Approved (Ready to Push)`
- `04 - Disqualified / Errors`

---

## 4. Environment Variables

The system requires the following environment variables to function:

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
