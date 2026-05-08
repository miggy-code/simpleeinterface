# Generic-first personalization — setup guide

> **⚠️ Mostly DEPRECATED — see canonical reference.** The "campaign default hook"
> model described below was abandoned. The `Campaigns` table no longer exists in
> this base (it was deleted as part of the GTM/Internal split — see
> `Airtable_Base_Split_Migration_Plan.md`). The system today calls DeepSeek with
> the lead's `Personalization Insights` and either gets a hook or doesn't — there
> is no campaign-level fallback. The `Personalization Confidence` and
> `Personalization Reviewed` columns described below ARE still planned and will be
> added in PR-2. Treat [`Data_Flow_and_Schema_Map.md`](./Data_Flow_and_Schema_Map.md)
> as the source of truth for current state. The notes below are kept for historical
> context — the verb-regex post-check (§ 7) is still in `lib/ai.ts` and is current.

The code in this PR is resilient: every feature that depends on new Airtable
schema will **fail soft** (log a warning, keep going) until the schema is
provisioned. You can merge and deploy before running this guide, then provision
when ready.

---

## 1. New Airtable table — Campaigns

Create a new table called **Campaigns** inside your existing **ThrottlGTM** base.

| Field name | Field type | Notes |
|---|---|---|
| Name | Single line text | Campaign name (from Instantly) |
| Instantly Campaign ID | Single line text | The UUID from Instantly — used as the lookup key |
| Default Hook | Long text | The fallback hook the AI writes at creation time. Operator can edit. |
| Created At | Created time | Auto-filled |

**Base ID**: same base as your Leads table — `AIRTABLE_BASE_ID` in `.env`.

After creating the table, copy the **Table ID** (starts with `tbl…`) and add it
to your environment:

```
AIRTABLE_CAMPAIGNS_TABLE_ID=tblXXXXXXXXXXXXXX
```

---

## 2. New columns on the Leads table

### Personalization Confidence

- **Field type**: Single select
- **Options** (add exactly, spelling matters):
  - `High`
  - `Medium`
  - `Low`
- The code writes one of these strings; the UI renders a coloured pill.

### Personalization Reviewed

- **Field type**: Checkbox
- Checked = human has reviewed (or no review needed).
- The UI's "Needs review" filter queries `{Personalization Reviewed} = FALSE()`.

---

## 3. Environment variables summary

Full list of variables the app needs (see `.env.example` for the complete
template):

```bash
# Existing
AIRTABLE_API_KEY=
AIRTABLE_BASE_ID=
AIRTABLE_LEADS_TABLE_ID=

# New — add after provisioning
AIRTABLE_CAMPAIGNS_TABLE_ID=tblXXXXXXXXXXXXXX
```

---

## 4. How the generic-first model works

```
Run AI for lead
    │
    ├─ confidence: High + non-null hook
    │       └─ Write AI hook → lead.personalizationHook
    │          Mark reviewed = true
    │
    ├─ confidence: Medium + non-null hook
    │       └─ Write campaign.defaultHook → lead.personalizationHook
    │          Mark reviewed = false  (appears in review queue)
    │          AI attempt preserved in personalizationNotes
    │
    └─ confidence: Low  OR  hook: null
            └─ Write campaign.defaultHook → lead.personalizationHook
               Mark reviewed = true  (no review needed)
               AI reasoning preserved in personalizationNotes
```

**No campaign default available?** The system falls back to the AI's hook (or
empty string for null). This keeps the system working even before the Campaigns
table is provisioned.

---

## 5. Revert to default

Operators can click **Revert to default** in HookReviewModal or
PersonalizationWorkbench to call `POST /api/leads/:id/revert-hook`. This:

1. Fetches the campaign's current `defaultHook`.
2. Writes it to `lead.personalizationHook`.
3. Sets confidence → Low, reviewed → true.

Useful when a High-confidence AI hook turns out to be wrong after manual review.

---

## 6. Editing the default hook

During campaign creation, the wizard's **Review** step shows an editable
`Default Hook` field. Changes are saved to the Campaigns table before the
campaign is pushed to Instantly.

The default hook can also be edited directly in Airtable at any time.

---

## 7. Verb-regex post-check

After the AI returns a hook, `lib/ai.ts` runs a simple regex to verify a verb
is present in the first clause. If no verb is detected and the AI returned
`High` confidence, confidence is downgraded to `Medium`. This prevents
fragments from being auto-approved.

The regex is intentionally loose (`/\b(is|are|has|have|was|were|had|did|does|do|launched|raised|expanded|won|joined|built|created|grew|scaled|hired|opened|closed|announced|released|published|wrote|led|ran|managed|helped|worked|uses|used|offers|offered|serves|served|enables|powers|provides|focuses|focuses|specializes)\b/i`).
False negatives (real verbs not in the list) → Medium confidence (safe).
False positives are not possible — the check only downgrades.
