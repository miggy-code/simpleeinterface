# UI Improvement Plan

**Status:** Future backlog  
**Scope:** Operator UI only  
**Primary goal:** Keep reducing friction in the hook review workflow while preserving enough context to make high-confidence approval decisions.

## Product Direction

This app is not a general CRM. Its main job is to help the operator:

1. Review leads.
2. Inspect factoids and campaign context.
3. Write or refine a personalization hook.
4. Approve that hook with confidence.
5. Push the lead to Instantly when ready.

Campaigns remain important, but they are a setup and maintenance area, not the default center of daily operator work.

## Core UX Principles

- Hook quality is the center of the product.
- Approval is a commit action, not an editing action.
- Editing must be fast, but it should not hide the context needed to make a good decision.
- Advanced metadata should be available without dominating review screens.
- Campaigns should stay easy to reach and usable daily, but visually secondary to lead review.
- If a screen has too many actions, hide the least important actions before compressing text or weakening hierarchy.

## Future Improvement Backlog

### P1 - Add next-best-action labels

Show a persistent `Next best action` label per lead, such as:

- `Assign campaign`
- `Generate hook`
- `Review hook`
- `Approve hook`
- `Push to Instantly`

This would make the queue scannable without requiring the operator to infer state from several columns.

### P1 - Add saved queue views

Add fast presets for common operating modes:

- `Needs campaign`
- `Needs hook`
- `Ready to review`
- `Approved, not pushed`
- `Recently generated`

These should behave like view shortcuts, not a separate reporting surface.

### P1 - Add row-level loading states

Quick row actions should show which exact lead is being updated. This matters most for approval, push, generation, and campaign assignment.

### P1 - Add a hook quality checklist

Add a compact checklist near hook review:

- Specific to this lead or company.
- Supported by a visible factoid or source.
- Relevant to the campaign promise.
- Short enough to fit naturally inside the first email.
- No unsupported claims.

The checklist should support judgment, not become a blocking form.

### P1 - Add source credibility signals

Show credibility markers beside research factoids so weak signals are easier to catch before approval.

Examples:

- Direct company source.
- News or trade publication.
- Directory / scraped source.
- Missing source.
- Stale source.

### P2 - Add keyboard-first queue review

Add keyboard shortcuts for high-volume review after the operator enters review mode.

Useful shortcuts:

- Open / edit current lead.
- Save draft.
- Approve.
- Skip.
- Disqualify.
- Next / previous lead.

Shortcuts should be visible in the UI and should not trigger while typing in fields.

### P2 - Improve campaign context during lead review

Show more campaign context where it helps approval quality:

- Campaign goal.
- Audience segment.
- First-email promise.
- Sequence length.

Keep this optional or collapsible so it does not crowd the hook editor.

### P2 - Collapse low-frequency lead detail fields

Group lower-priority fields into collapsible sections:

- `Advanced lead data`
- `System sync data`
- `Engagement history`

The default lead detail view should stay focused on hook review and source verification.

### P2 - Improve empty states

Replace generic empty states with specific recovery actions:

- `Create campaign`
- `Assign selected leads`
- `Generate hooks`
- `Import more leads`
- `Clear filters`

### P3 - Build mobile-specific queue cards

The table is best on desktop. A mobile queue should use dense cards with:

- Lead identity.
- Company context.
- Hook readiness.
- Next best action.
- One overflow menu for secondary actions.

### P3 - Revisit archive UX

Archive is useful, but it should stay secondary until the core review workflow is fully polished.

Potential improvements:

- Better filtering by archive reason.
- Clearer re-engagement eligibility.
- Compact summaries of last campaign outcome.
