# ThrottlGTM Airtable Cleanup & UI V2 Plan

> **⚠️ Partially completed.** The cleanup analysis below was written when the
> Leads table had 48 fields; it now has 42 (some redundant fields were removed).
> The 3-table architecture recommendation (§ 2) was followed — see
> `docs/Airtable_Base_Split_Migration_Plan.md`. The UI V2 features in § 3
> (bulk approval, inline editing, campaign perf, nurture angles) are NOT all
> implemented; tracking continues in [`docs/Future_Improvements.md`](./docs/Future_Improvements.md).
> For current schema, see [`docs/Data_Flow_and_Schema_Map.md`](./docs/Data_Flow_and_Schema_Map.md).

This document outlines a comprehensive plan to clean up the ThrottlGTM Airtable base, evaluates the architecture of the re-engagement system, and proposes a second pass of UI improvements for the Throttl Outreach web app.

## 1. Airtable Cleanup Analysis

The `Leads` table currently has 48 fields. Over time, as the system has evolved from a manual CRM to an AI-driven pipeline, several fields have become redundant or obsolete.

### Fields to Delete (Redundant / Unused)

The following fields are no longer used by the new web app architecture and should be deleted to reduce clutter:

| Field Name | Type | Reason for Deletion |
|---|---|---|
| `Status` (legacyStatus) | Single Select | Replaced entirely by `Pipeline Status`. |
| `Assignee` | Collaborator | The new system is designed for a unified queue; individual assignment is no longer tracked at the lead level. |
| `Attachments` | Multiple Attachments | Unused in the lead context. |
| `Attachment Summary` | AI Text | Dependent on `Attachments`; unused. |
| `Personalized Subject` | Single Line Text | The new strategy uses campaign-level templates with a single `{{personalization_hook}}` variable. |
| `Personalized Email Body` | Multiline Text | Same as above; the full body is no longer generated per lead. |
| `Emails Sent` | Number | Instantly's API does not easily expose total emails sent per lead; we only track opens and replies. |

### Fields to Consolidate

| Current Fields | Proposed Action |
|---|---|
| `City`, `State` | Combine into a single `Location` field (Single Line Text). The AI can parse "Worcester, MA" just as easily as separate fields, and it saves horizontal space. |
| `Source`, `Source Detail` | Combine into a single `Source` field (Single Line Text). E.g., "AI Prospecting: Worcester Mfg Search". |

### Recommended View Structure

Currently, there is only a single "Grid view". You should create the following views in the `Leads` table to match the workflow:

1. **01 - Ingestion Queue:** Filter: `Pipeline Status` is any of (New, Researching, Ready to Personalize).
2. **02 - Needs Approval:** Filter: `Pipeline Status` = Personalized.
3. **03 - Approved (Ready to Push):** Filter: `Pipeline Status` = Approved.
4. **04 - Disqualified / Errors:** Filter: `Pipeline Status` = Disqualified OR `Sync Errors` is not empty.

---

## 2. Re-engagement: Flag vs. Separate Table

You asked if re-engagement could just be a flag in the main `Leads` table instead of moving records to a separate `Re-engagement Archive` table.

### The Verdict: Keep the Separate Table

While a flag (e.g., a checkbox or a specific `Pipeline Status`) is technically simpler to implement, **a separate table is highly recommended for this specific architecture.**

Here is the reasoning:

1. **Performance and API Limits:** The web app fetches leads from Airtable on every load. If you keep all historical, archived, and re-engagement leads in the main table, the API payload will grow indefinitely. By moving them to an archive table, the `Leads` table remains a lightweight, fast "working queue."
2. **Schema Divergence:** A lead in the initial outreach phase needs fields like `Personalization Hook`, `Personalization Notes`, and `Insights`. A lead in the re-engagement phase needs fields like `Archive Reason`, `Re-engagement Campaign`, and `Nurture Score`. Keeping them in one table results in dozens of empty columns for any given lead.
3. **Instantly Campaign Management:** When a lead finishes the 21-day sequence, you will likely want to push them into a *new* Instantly campaign (the nurture sequence). Moving them to a new Airtable table provides a clean break, allowing you to clear the `Instantly Campaign ID` and start fresh without losing the historical context of the first campaign.

**Recommendation:** Stick with the three-table architecture (Ingestion → Active Outreach → Archive) implemented in the recent update. It scales much better for high-volume cold email operations.

---

## 3. Web App UI: Second Pass Improvements

The first pass established the functional interface layer. The second pass should focus on speed, bulk operations, and deeper Instantly integration.

### Proposed Features for V2

#### A. Bulk Approval & Push
Currently, you must click into each lead to approve and push it.
*   **Feature:** Add checkboxes to the Ingestion Dashboard.
*   **Action:** Allow selecting multiple leads with `Pipeline Status = Approved` and pushing them all to a selected Instantly campaign with a single click.

#### B. Inline Hook Editing
Opening the Personalization Workbench for every lead is slow if the AI did a good job and you only need to make a minor tweak.
*   **Feature:** Make the `Personalization Hook` column in the Ingestion Dashboard an editable text field.
*   **Action:** Allow editing and saving the hook directly from the table view.

#### C. Campaign Performance Mini-Dash
The Active Outreach panel currently shows aggregate stats across all campaigns.
*   **Feature:** Add a "Group by Campaign" toggle.
*   **Action:** Show open rates, reply rates, and bounce rates broken down by the specific Instantly campaign, pulling data directly from the Instantly `/campaigns/summary` endpoint.

#### D. AI "Nurture Angle" Generator
When leads move to the Re-engagement Archive, they need a new angle.
*   **Feature:** Add a "Generate Nurture Angle" button in the Archive Panel.
*   **Action:** Use the original `Personalization Insights` plus the `Reply Sentiment` (if any) to generate a soft-touch follow-up idea (e.g., "Send them the Q3 Logistics Report").

### Implementation Priority

If approved, the next development sprint should focus on **A (Bulk Push)** and **B (Inline Editing)**, as these will immediately reduce the time you spend managing the system.
