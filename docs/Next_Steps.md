# Next Steps — Outreach Flow

**Status:** Active planning doc. Updated 2026-05-05 after the Leads-first outreach refactor.

For the UI direction and redesign priorities, see `UI_Improvement_Plan.md`.

The current production model is `Leads -> Re-engagement Archive`. `Leads` remains the source of truth through initial outreach; `In Campaign` is a dashboard filter on `Pipeline Status = In Campaign`, not a separate Airtable table.

## Recently Completed

- Created the live Airtable `Initial Outreach Date` field on `Leads` as a `dateTime` field. No records were backfilled.
- Replaced the Active Outreach data source with Leads-based `In Campaign` filtering.
- Updated single and bulk push to use the same server-side helper.
- Successful pushes now update the existing Lead with `Instantly Lead ID`, campaign fields, `Pipeline Status = In Campaign`, and `Initial Outreach Date`.
- Engagement sync now writes opens, replies, bounces, unsubscribes, timestamps, and sync errors back to Leads.
- Re-engagement checks now move eligible Leads directly to `Re-engagement Archive` using `Initial Outreach Date + 21 days`.
- Missing `Initial Outreach Date` no longer archives a lead accidentally; it writes a visible `Sync Errors` message.
- Archive writes are limited to fields that exist on `Re-engagement Archive`.
- Dashboard tabs now read `Campaigns`, `Lead Queue`, `In Campaign`, and `Re-engagement Archive`.
- The broken `/leads/new` empty-state CTA was removed from the visible queue UI.
- Queue filtering/count derivation was extracted into `components/ingestion/useLeadQueue.ts`.
- Hook generation now requires an assigned Instantly campaign, fetches the campaign's real first email, and asks DeepSeek to write the exact `{{personalization_hook}}` replacement for that template.
- Lead Detail and Hook Review now show the hook variable separately from the actual campaign email preview, instead of a hard-coded generic email.

## User Story Gaps

### P0 — Validate the Airtable Field Rollout

**Story:** As an operator, I need every pushed lead to get a reliable initial outreach timestamp so the archive cron can make correct decisions.

**Status:** Done for schema rollout on 2026-05-05. `Initial Outreach Date` exists on `Leads` as a `dateTime` field. No backfill was performed.

**Next steps:**
- Backfill it for any existing `In Campaign` Leads that were pushed before the refactor, if historical rows exist.
- Create an Airtable view for `Pipeline Status = In Campaign` and missing `Initial Outreach Date`.

### P1 — Finish the Lead Queue UI Split

**Story:** As a developer, I need the Lead Queue surface to be maintainable enough for future workflow changes.

**Gap:** `useLeadQueue` now owns filtering/counts/selection derivation, but `IngestionDashboard.tsx` still owns actions, modals, table markup, and modal state.

**Next steps:**
- Extract `useLeadActions` for assign, generate, review, push, delete, and refresh.
- Extract `LeadQueueSummary`, `LeadQueueFilters`, `LeadQueueTable`, `BulkActionBar`, and modal components.
- Keep server action calls in one hook so local state and rehydration behavior are consistent.

### P1 — Add a Real Review State

**Story:** As an operator, I need the review queue to show only leads that actually need review.

**Gap:** The review modal still infers the queue from `Personalization Hook` plus `Pipeline Status`, because `Personalization Reviewed` is not provisioned as a reliable field.

**Next steps:**
- Add `Personalization Reviewed` to Airtable.
- Update approve/disqualify/skip actions to write it.
- Change the review query to `Pipeline Status = Personalized AND Personalization Reviewed != true`.

### P1 — Keep Default Hooks Explicit

**Story:** As an operator, I need to avoid sending weak personalization when the AI has no specific signal.

**Gap:** Default hooks live on Instantly campaigns, and the review UI should make that source explicit whenever a default is used or reverted to.

**Next steps:**
- Surface the Instantly default hook source and text in review.
- Keep the "revert to default" action disabled when no Instantly default is available.

### P1 — Build Instantly Webhook Intake

**Story:** As an operator, I need reply/bounce/open state to update without waiting for polling.

**Gap:** Engagement state is still polling-based via scheduled sync/manual refresh.

**Next steps:**
- Add `POST /api/webhooks/instantly`.
- Verify webhook signatures if Instantly supports signing.
- Match events to Leads by `Instantly Lead ID`.
- Write `Last Synced At` and `Sync Errors` consistently.

### P2 — Archive/Nurture Campaign Push

**Story:** As an operator, I need to turn archived leads into a re-engagement campaign without manual copy/paste.

**Gap:** Archive generates nurture angles, but there is no push-to-nurture campaign flow.

**Next steps:**
- Add campaign picker to archive rows or bulk selection.
- Push to a selected nurture campaign using the chosen AI nurture angle as a custom variable.
- Decide whether this should update `Re-engagement Campaign` in Airtable.

## UI/UX Findings

- The primary tab names are now clearer, but the underlying component name `ActiveOutreachPanel` is stale and should be renamed to `InCampaignPanel`.
- The `In Campaign` table now shows outreach date, days until archive, engagement, and sync errors, but rows do not link to the Lead detail page yet.
- `Lead Queue` still uses local component state heavily; after patch calls, the operator can see stale state until refresh.
- The status quick-switch on Lead Detail still lets operators jump to terminal states without confirmation.
- Empty-state copy now points to external sourcing, but the dead `/leads/new` route still exists as a redirect and should be removed or replaced with a deliberate explanation page.
- The archive check button says it scans active leads; text should say it scans in-campaign Leads.

## Verification Checklist

- `npm run typecheck`
- Push one approved Lead with an assigned campaign and confirm Airtable writes `Instantly Lead ID`, campaign fields, `Pipeline Status = In Campaign`, and `Initial Outreach Date`.
- Bulk push two approved Leads and confirm neither creates an Active Outreach record.
- Run engagement refresh and confirm Lead engagement fields update.
- Run re-engagement check on a Lead older than 21 days and confirm it moves to `Re-engagement Archive`.
- Run re-engagement check on an in-campaign Lead missing `Initial Outreach Date` and confirm it stays in Leads with `Sync Errors`.
