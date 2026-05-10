# Throttl CRM Operator SOP

**Purpose:** This is the operating guide for the current site as implemented in code. It tracks the live user stories, the data flow, and the exact steps an operator should follow to use the app safely.

## 1. What This Site Is For

The app is the operator surface for a lead workflow with four main jobs:

1. Clean and review lead records.
2. Assign a lead to an Instantly campaign.
3. Verify email safety, approve the lead, and push it to Instantly.
4. Monitor engagement and archive leads after the sequence is done.

The site is not a general CRM editor. It is a workflow tool over Airtable and Instantly.

## 2. Live User Stories

These are the stories the code currently supports.

| Story | What the operator does | Code surface |
|---|---|---|
| Review leads | Clean lead fields, inspect queue state, and pick the right next action. | `/` dashboard, `components/IngestionDashboard.tsx` |
| Assign campaign | Put a lead into the correct Instantly campaign before generation or push. | `PATCH /api/leads/:id`, campaign selector in the queue and detail view |
| Generate hook | Create a personalization hook from the lead's research insights and campaign context. | `POST /api/leads/batch-personalize`, `lib/personalize.ts`, `lib/ai.ts` |
| Review hook | Approve, edit, revert, skip, or disqualify the hook. | `components/HookReviewModal.tsx`, `POST /api/leads/:id/revert-hook` |
| Verify email | Run DeBounce before outreach. | `POST /api/leads/verify` |
| Push to Instantly | Send safe leads into the assigned campaign and set the outreach timestamp. | `POST /api/leads/:id/push`, `POST /api/leads/bulk-push`, `lib/outreach.ts` |
| Monitor in campaign | Watch opens, replies, bounces, and unsubscribe state after push. | `components/ActiveOutreachPanel.tsx`, `POST /api/engagement/refresh` |
| Archive leads | Move completed or terminal leads into the archive after the sequence ends. | `POST /api/reengagement/trigger`, `lib/services/reengagement.ts` |
| Generate nurture angles | Produce follow-up content ideas for archived leads. | `components/ArchivePanel.tsx`, `POST /api/leads/:id/nurture-angles` |
| Manage campaigns | Create and edit Instantly campaign sequences. | `components/CampaignsTab.tsx`, `app/campaigns/editor/page.tsx`, `app/api/campaigns/*` |

## 3. Data Flow

### 3.1 Source of Truth

- Airtable `Leads` is the working source of truth.
- `Instantly` holds campaign execution and engagement tracking.
- The dashboard reads `Leads` on page load and then mutates those rows through API routes.

### 3.2 Lead Lifecycle

```text
Lead exists in Airtable
  -> operator reviews and cleans fields
  -> operator assigns Instantly campaign
  -> system generates hook
  -> operator approves / edits / reverts / disqualifies
  -> operator verifies email with DeBounce
  -> operator pushes to Instantly
  -> code writes Instantly Lead ID, campaign fields, Initial Outreach Date, Pipeline Status = In Campaign
  -> engagement sync updates opens / replies / bounces / unsubscribes
  -> re-engagement job moves eligible leads to archive
  -> archive panel generates nurture angles for follow-up
```

### 3.3 Important Write Paths

- `PATCH /api/leads/:id` updates Airtable lead fields.
- `POST /api/leads/batch-personalize` writes hook-related fields after AI generation.
- `POST /api/leads/:id/revert-hook` restores the campaign default hook and records the fallback source.
- `POST /api/leads/:id/push` and `POST /api/leads/bulk-push` create the Instantly lead and update Airtable with outreach metadata.
- `POST /api/engagement/refresh` pulls engagement state back from Instantly.
- `POST /api/reengagement/trigger` moves eligible leads into archive.
- `POST /api/leads/:id/nurture-angles` generates archive follow-up ideas.

## 4. How To Use The Site

### 4.1 Open The Dashboard

1. Load `/`.
2. Wait for leads and campaigns to render.
3. Use the Leads tab for active work.
4. Use the Campaigns tab only when you need to create or edit a campaign.

### 4.2 Clean A Lead

1. Open the lead in the queue or detail view.
2. Fix required fields first:
   - First Name
   - Email
   - Company Name
   - Title
   - Industry
3. Save before running DeBounce or pushing.
4. If the row is already dirty, the app blocks verification and push until saved.

### 4.3 Assign A Campaign

1. Select the lead.
2. Choose an Instantly campaign.
3. Save the assignment.
4. Do not generate a hook before the campaign is assigned.

### 4.4 Generate And Review A Hook

1. Run batch personalization or open the hook review modal.
2. Check whether the hook is based on a real signal from `Personalization Insights`.
3. Review the hook source badge:
   - `AI Specific`
   - `Campaign Default`
   - `Manual Edit`
   - `Reverted Default`
4. If the AI produced a weak hook, edit it or revert to the campaign default.
5. Approve only when the final hook is acceptable.

### 4.5 Verify Before Push

1. Run DeBounce.
2. Only push leads that return `Safe to Send`.
3. If the lead is blocked, fix the data or leave it out of the batch.

### 4.6 Push To Instantly

1. Push from the lead detail view or bulk push from the queue.
2. Confirm the lead has:
   - an Instantly campaign
   - a safe email verification result
   - no unsaved edits
3. After push, the app should write:
   - `Instantly Lead ID`
   - `Instantly Campaign ID`
   - `Instantly Campaign Name`
   - `Initial Outreach Date`
   - `Pipeline Status = In Campaign`
4. Once pushed, the lead disappears from the active queue and appears in the In Campaign tab.

### 4.7 Monitor Active Campaigns

1. Switch to the In Campaign tab.
2. Check opens, replies, bounces, unsubscribes, and sync errors.
3. Use `Refresh engagement` if the data looks stale.
4. Fix rows with missing outreach dates or sync errors before archiving them.

### 4.8 Archive Completed Leads

1. Run the re-engagement check.
2. Leads with terminal outcomes or expired outreach windows move to archive.
3. Leads with reply or meeting outcomes stay in the active flow until you decide what to do next.

### 4.9 Generate Nurture Angles

1. Open the Archive tab.
2. Expand a lead row.
3. Generate nurture angles.
4. Copy the angle and hook text into the follow-up campaign process you use in Instantly.

### 4.10 Manage Campaigns

1. Open the Campaigns tab.
2. Create a new campaign from the starter sequence if needed.
3. Edit the sequence in the campaign editor.
4. Keep the first email compatible with `{{personalization_hook}}`.

## 5. Operational Rules

1. Save edits before running DeBounce or pushing.
2. Do not push unassigned leads.
3. Do not push leads that are not safe to send.
4. Do not approve hooks that are generic, unsupported, or clearly off-message.
5. Do not expect archive timing to work if `Initial Outreach Date` is missing.
6. Do not edit campaign copy unless you intend to change the live Instantly sequence.
7. Do not treat the archive as an active working queue; it is a follow-up repository.

## 6. Error Handling

### Missing Required Fields

- Fix the lead record before doing anything else.
- The UI will flag missing fields in the active queue and lead detail view.

### No Campaign Assigned

- Assign an Instantly campaign before generating hooks or reverting to a default hook.

### DeBounce Is Not Safe

- Do not push the lead.
- Fix the email or leave the lead out of the push batch.

### Missing Outreach Date

- This means the lead was not pushed correctly or the record is stale.
- Fix the record before relying on archive timing.

### No Campaign Default Hook

- Revert will fail if the campaign has no default hook configured.
- Set the default in Instantly before using revert-to-default.

### Engagement Sync Errors

- Refresh again after checking the lead ID and campaign ID.
- If the error persists, inspect the lead record in Airtable.

## 7. Data Ownership Summary

- Airtable owns lead storage.
- Instantly owns campaign execution and email events.
- The dashboard owns operator actions and field updates.
- DeepSeek owns hook generation and nurture-angle generation.

## 8. Quick Daily Checklist

1. Open the dashboard.
2. Clean lead fields.
3. Assign campaign.
4. Generate or review hook.
5. Approve or edit.
6. Run DeBounce.
7. Push safe leads.
8. Check In Campaign for sync issues.
9. Run archive checks as needed.
10. Generate nurture angles for archived leads.

