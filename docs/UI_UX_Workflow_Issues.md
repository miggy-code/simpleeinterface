# UI/UX Workflow Issues

This doc is a short, living list of confusing or broken operator flows found while reading and refactoring the app. Architecture notes belong in `Data_Flow_and_Schema_Map.md`; prioritized implementation work belongs in `Next_Steps.md`; the dedicated UI direction and redesign plan lives in `UI_Improvement_Plan.md`.

## High Priority

- Resolved 2026-05-05: the visible empty-state CTA to `/leads/new` was removed. Remaining follow-up: remove or replace the redirect-only route so deep links do not look like a supported creation flow.
- Resolved 2026-05-05: push now updates the existing Lead in place with Instantly IDs, campaign fields, `Pipeline Status = In Campaign`, and `Initial Outreach Date`.
- Resolved 2026-05-05: re-engagement cron/manual trigger now writes `Sync Errors` through `updateLead`, and missing `Initial Outreach Date` is surfaced instead of causing accidental archive.
- Resolved 2026-05-05: the live Airtable base now contains `Initial Outreach Date` on Leads as a `dateTime` field. No backfill was performed.
- Resolved 2026-05-05: hook generation requires campaign assignment and uses the assigned campaign's actual first email template as context.
- Resolved 2026-05-05: Lead Detail and Hook Review previews separate the hook variable from the generic campaign email and render the real Instantly campaign template.
- Resolved 2026-05-05: campaign generation and revert flows now use the Instantly campaign default hook as the fallback source, and the review UI can show that source explicitly.

## Medium Priority

- Batch hook generation opens the review modal for every unapproved hook lead, not just the leads just processed. The overlay says `Continue to review`, but the next screen can include older records and make the action feel disconnected from the button that launched it.
- Resolved 2026-05-05: mixed campaign selections use each lead's assigned campaign; unassigned selections block generation with a warning.
- The lead detail page treats every pipeline status as equally selectable. That is efficient for power users, but it also makes it easy to jump to terminal states with no confirmation or explanation of the consequences.
- Resolved 2026-05-05: bulk push rehydrates from returned Airtable Lead payloads instead of leaving stale local rows behind.
- Resolved 2026-05-05: bulk push returns full updated Lead records and replaces local rows after successful pushes.
- The `In Campaign` table shows sync state, but rows do not link back to Lead Detail for fixing missing outreach dates or sync errors.

## Low Priority

- Resolved 2026-05-05: the dashboard now uses `Lead Queue` and `In Campaign`; `In Campaign` is a Leads-table filter instead of a separate snapshot table.
- The review modal is useful, but it still feels detached from the queue source. The operator sees one lead at a time, yet the queue is assembled from `Pipeline Status` plus hook presence rather than a single explicit review state.
- The component name `ActiveOutreachPanel` is stale now that the user-facing tab is `In Campaign`.
- The manual archive-check button copy should say it scans in-campaign Leads, not "active leads".
