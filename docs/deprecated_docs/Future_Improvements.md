# Future Improvements & Feature Ideas

> Deprecated parking lot. The active prioritized plan is now
> [`../Next_Steps.md`](../Next_Steps.md), and active UI/UX findings are in
> [`../UI_UX_Workflow_Issues.md`](../UI_UX_Workflow_Issues.md). This file remains
> as historical context only; references to Active Outreach or the old PR
> sequence may be stale.

Captured while writing `Data_Flow_and_Schema_Map.md`. Each idea is a self-contained sketch with a priority and rough effort. Nothing here is committed; this is the parking lot for things that fell out of the data-flow audit but don't belong in PR-1/2/3/4.

Organize as follows:
- **A** Hook Quality Dashboard — beyond the v1 story
- **B** Prompt iteration tooling
- **C** Reviewer & operator experience
- **D** Outcome learning
- **E** Schema & data integrity
- **F** Workflow automation
- **G** UI/UX polish

Priority legend: **P0** (next sprint), **P1** (this quarter), **P2** (when you have a free afternoon), **P3** (parking lot).
Effort legend: **XS** (<1h), **S** (1–4h), **M** (half day), **L** (1–2 days), **XL** (3+ days).

---

## A. Hook Quality Dashboard — beyond the v1 story

The Story 01 dashboard (`/quality`) ships the basics: stacked bar of confidence × week, median word count, % using campaign default. These are the additions worth sketching.

### A1. Personalization Insights coverage chart **(P1, M)**

Right now we don't measure what fraction of leads even have insights to work from. A leads-without-insights percentage tells Gabriel whether the prompt is failing or the upstream agent is failing.

- **Chart:** stacked bar per week — `% with insights >100 chars` vs `% empty` vs `% sparse (<100 chars)`.
- **Why it matters:** disambiguates "bad hook because bad prompt" from "bad hook because bad data".
- **Where:** `/quality` page, fourth chart.

### A2. Drill-down to the failing leads **(P0, S)**

The v1 dashboard shows aggregates. When something looks wrong ("Low share spiked to 60%"), the next click should be a list of the actual leads that contributed.

- Each chart segment is clickable → opens a side panel listing the leads in that bucket with the hook text inline.
- "Open in workbench" link from each list row.
- Filter persistence in URL params so you can share a link to "all Low-confidence leads from Tuesday".

### A3. Prompt-version annotations on charts **(P1, M)**

Mentioned in Story 01 but worth elevating. Every chart gets vertical lines marking when the prompt template changed. Visual correlation of "did this change help?".

- Source for prompt-version: hash of the system prompt text written to a small JSON file on each deploy (`tests/prompts/.versions.json`).
- Annotation API in the dashboard reads that file.

### A4. Confidence vs engagement scatter **(P1, L)**

Once Active Outreach has data, a simple chart: confidence on X-axis, reply rate on Y-axis. If the High-confidence column doesn't outperform Low, the system isn't earning its DeepSeek bill.

- Cohort by confidence; show open / reply / meeting rates per cohort.
- Statistical-significance flag when n is too low.
- This is essentially Story 08 from the visibility doc — worth implementing once enough leads have moved through outreach.

### A6. Hook diversity / repetition score **(P2, M)**

Two hooks that say "noticed you're a family-run business since the 1950s" are both verb-led, both reference a fact, and both pass every assertion. But they're identical in spirit. A small diversity score (e.g. mean cosine distance between weekly hook embeddings) tells you whether the prompt has flattened into a template.

- Run the embeddings via DeepSeek's embedding endpoint or a small local model.
- One number: "hook diversity index" (higher is better).

### A7. Lead source × hook quality matrix **(P2, S)**

Cross-tab of `Source` (AI Prospecting / Manual / Referral / etc.) vs confidence. Reveals whether AI Prospecting leads have systematically worse insights than manually-sourced ones.

- 2D grid, color cells by High share.
- Sort sources by High share descending.

### A8. Time-to-personalization SLA **(P3, S)**

Histogram of `Personalization Generated At - Created At`. If most leads sit for >3 days before being personalized, that's a workflow signal, not a quality signal — but Gabriel still wants to know.

---

## B. Prompt iteration tooling

The testing library (PR-3) gives us reproducibility on fixtures. These tools take iteration further.

### B1. Prompt diff playground **(P0, L)**

Per Story 04 in the visibility doc. Two text areas (current vs proposed prompt), pick 20 random Approved leads, run both prompts side by side. No writes to Airtable.

- Page: `/admin/prompt-diff`
- Sample selector: random / by industry / by ICP Fit / by date range / specific lead IDs
- Differences highlighted (jsdiff or prompt-diff visualization)
- Aggregate metrics at top (confidence distribution, word count, % null) per side
- "Promote right side" → opens a PR with the diff (don't auto-merge to lib/prompts.ts)

### B2. Versioned prompts in Airtable **(P1, L)**

Per Story 05. Move the system prompt out of `lib/prompts.ts` as the source of truth into a new `Prompt Versions` table.

- Hot-reloadable + revertable without redeploy
- 60-second cache; fall back to hardcoded version on cache miss
- "Promote" button flips Active to a different version atomically
- Pairs with B1 — diff playground writes new versions here

**Caveat:** adds DB round-trip per AI call. Mitigated by cache.

### B3. Snapshot diff between test runs **(P1, M)**

Per the testing-library design doc § 06 "version diff report". The runner already records prompt-version + parsed result per story. Storing snapshots lets you generate a diff report between any two runs (not just last-green vs current).

- `tests/prompts/snapshots/{storyId}/{promptVersionHash}.json`
- Compare command: `npm run test:prompts:diff <version-a> <version-b>`
- Useful to retroactively bisect "when did this story start failing".

### B4. CI gate on prompt changes **(P1, M)**

GitHub Actions workflow runs `test:prompts:cheap` on every PR. Standard mode runs only on PRs that touch `lib/prompts.ts` or `lib/ai.ts`. Full mode runs on the merge to main.

- DeepSeek key as a repo secret
- Caching keyed by prompt-version hash so re-runs of same prompt are free
- Annotate PR with pass/fail summary + confidence-distribution diff vs main

### B5. Prompt linter **(P3, S)**

Static checks that don't require an AI call:
- Prompt mentions a JSON shape that matches what code expects (`hook` / `confidence` / `reasoning`)
- Numeric bounds in the prompt match assertions (e.g. prompt says "under 20 words", `assertWordCount` uses 20)
- Examples in the prompt are valid hooks (pass the verb-regex)

---

## C. Reviewer & operator experience

### C1. Review queue with keyboard shortcuts **(P0, M)**

Per Story 06. The current UI has no concept of a queue — leads are reviewed one-at-a-time via lead-detail pages. Once `Personalization Reviewed` exists (PR-2), build:

- Page: `/review-queue` listing `Pipeline Status === "Personalized" AND Personalization Reviewed === false`, oldest first
- Click → opens `HookReviewModal` pre-loaded with arrow-key navigation
- Keyboard: `A` (Approve), `D` (Use default), `E` (Edit), `→` (Skip)
- Bulk select + apply-default-to-selected
- End-of-queue summary: "30 reviewed in 8m 24s · 12 approved · 11 defaulted · 7 skipped"

### C2. Failure-mode tagging **(P1, S)**

Per Story 07. When the operator rejects a hook, capture *why*.

- New Airtable column on Leads: `Rejection Reason` (multiSelect)
- Options: `Fabricated fact` / `Too generic` / `Wrong tone` / `Awkward fit with template` / `Started with "I"` / `Other`
- Tagged automatically when the operator clicks "Revert to default" or significantly edits the hook
- Top-rejection-reasons widget on the dashboard tells you which prompt rule needs tightening next

### C3. Calibration view in the review modal **(P1, M)**

Per Story 02. When Gabriel is judging a Medium-confidence hook, show 5 recent High examples and 5 recent Low examples side-by-side so he can sanity-check the AI's vocabulary.

- New endpoint `GET /api/personalization/calibration?campaignId=...`
- "More like this is High" / "More like this is Low" flags accumulate as future test fixtures (closes the loop into the testing library)

### C4. Inline hook editing on the pipeline view **(P1, S)**

Per `Airtable_Cleanup_and_UI_Plan.md` § 3.B. Click the hook column on the pipeline page → inline editor → save without opening lead detail. Trades depth for speed; useful when AI got 80% there.

### C5. Bulk approve + push **(P1, M)**

Per `Airtable_Cleanup_and_UI_Plan.md` § 3.A. Checkboxes on the pipeline view, multi-lead approve, multi-lead push to a chosen Instantly campaign.

- Already partially scaffolded: `app/api/leads/batch-personalize/route.ts` and `app/api/leads/bulk-push/route.ts` exist
- Wire UI to existing endpoints

### C6. Filtering & search on pipeline view **(P0, S)**

Currently the pipeline view shows all leads in source-order. Add:

- Status filter (single-select pill row)
- Industry / Revenue Band / ICP Fit dropdowns
- Free-text search (name / company / email substring)
- "Has insights" toggle
- URL-persisted state

### C7. Default sort: priority over creation date **(P0, XS)**

Per `Handoff_Throttl_CRM.md` § 3.4. Default sort: ICP Fit A first, then by Source Date desc. Don't show the operator a 3-month-old C lead at the top of the queue.

---

## D. Outcome learning

These all depend on Active Outreach having data. None of them work today (the table is empty).

### D1. Hook → engagement attribution **(P1, L)**

Story 08. Cohort table: AI High vs AI Medium vs (default — once campaign defaults are restored) → open / reply / meeting rates.

- Page: `/quality/attribution`
- Filterable by campaign, industry, date range
- Statistical significance flagging (chi-squared on small n)

### D2. Reply sentiment auto-classification **(P2, M)**

`Reply Sentiment` field exists (Interested / Neutral / Not Interested / Unclassified) but is filled manually. An AI classifier on inbound replies would auto-set it.

- Cron or webhook-triggered: when `Replied = true`, fetch the reply body from Instantly, ask DeepSeek to classify
- Confidence threshold: only auto-set if the model is High; else leave as Unclassified for manual review

### D3. Gold Hooks self-improvement loop **(P3, XL)**

Story 09. Hooks that resulted in a meeting become few-shot examples in future system prompts.

- New table: `Gold Hooks` in ThrottlGTM (or in ThrottlInternal)
- Triggered when `Meeting Booked = true` AND original confidence was High
- System prompt builder selects 2–3 industry-matching gold hooks per call (rotating)
- Cap to avoid prompt bloat

### D4. Cost meter + per-lead unit economics **(P2, S)**

Story 10. Log every DeepSeek call with token counts; show monthly burn + cost per personalized lead.

- New table: `Usage Log` (timestamp / type / lead_id / tokens_in / tokens_out / cost_estimate)
- Wrap `generateHook` in a small middleware
- Dashboard widget: "this month: $X across N personalized leads, projected $Y at current pace"
- Optional: budget threshold alert via Slack webhook

---

## E. Schema & data integrity

### E1. Add Personalization Confidence + Reviewed columns **(P0, S — covered by PR-2)**

Listed for completeness — PR-2 ships this.

### E2. Populate Companies table from Leads **(P1, M)**

The `Companies` table exists with 16 fields but is empty. Backfill it from the Leads table (group by `Company Name + Company Domain`), then set up a hook so new leads auto-link to or create their Company row.

- One-time backfill script: `scripts/backfill-companies.ts`
- Live linking: when a lead is created with a `Company Name` not in Companies, create the row + link
- Enables company-level metrics (total leads per company, win rate per company, etc.)

### E3. Enrichment-score derived field **(P1, S)**

Per Story 03 from the visibility doc. A 0–100 score per lead based on what fields are populated:

- +30 if Personalization Insights >100 chars
- +20 if Source URL or Source Detail set
- +15 if LinkedIn URL set
- +10 each for Industry, Revenue Band, Title, City+State
- Cap at 100

Computed on the fly in the dashboard. Disambiguates "Low because prompt failed" from "Low because data was thin".

### E4. Duplicate detection on lead creation **(P1, S)**

Currently `POST /api/leads` does some dedup (per README) but the rules aren't documented. Codify:
- Exact email match → block, return existing record
- (Email domain + first/last name) match → warn, allow override
- LinkedIn URL match → warn, allow override

### E5. Insights staleness flag **(P2, S)**

`Insights Refreshed At` field exists but isn't used. Show a small "stale" pill in the lead detail when insights are >30 days old, with a "regenerate insights" button (calls the upstream agent).

---

## F. Workflow automation

### F1. Implement forward-only table movement **(P1, L)**

The 3-table architecture (Leads → Active Outreach → Re-engagement Archive) is described in every doc but isn't implemented. Today everything stays in Leads forever. Either:

- (a) Implement the actual movement logic (create-then-delete) and fix the design intent
- (b) Embrace the single-table reality and update the docs accordingly

**Recommendation:** (b) for now. The pipeline-status state machine is doing the work the table movement was supposed to do. A single-table design is simpler. The Active Outreach + Archive tables can be repurposed (or deleted).

### F2. 21-day re-engagement cron **(P1, S)**

`app/api/cron/reengagement/route.ts` exists. Verify it's deployed as a Vercel cron and runs nightly. Failure mode today: silent.

### F3. Hourly engagement sync **(P1, S)**

`app/api/cron/sync-engagement/route.ts` exists. Same verification — is it actually running? Add observability (last-run timestamp, count of leads updated, error count).

### F4. Slack webhook for high-confidence + meeting **(P2, S)**

When a lead replies with `Reply Sentiment === Interested` OR `Meeting Booked === true`, post a Slack message. High-signal events deserve real-time attention, not a daily report.

### F5. Insights enrichment runner **(P2, M)**

Currently insights are populated by an external agent. Add a "Generate insights" button per-lead that triggers a Hyperagent webhook (or runs a local Firecrawl + DeepSeek pipeline) and fills the Personalization Insights field.

---

## G. UI/UX polish

### G1. Status pill color consistency **(P2, XS)**

13 pipeline statuses, ensure each has a distinct + meaningful color (terminal red, win green, in-progress amber, ready blue). Audit current `StatusPill.tsx`.

### G2. Dashboard mobile responsive **(P2, S)**

The pipeline table on mobile becomes unusable. Either:
- Card view on small screens
- Or: explicit "use a desktop" warning + simplified mobile-only view (read-only stats)

### G3. Keyboard shortcuts on pipeline **(P2, S)**

Beyond review queue (C1):
- `/` to focus search
- `j` / `k` to navigate rows
- `Enter` to open lead detail
- `?` to show help

### G4. Lead detail tabs **(P2, S)**

Today lead detail is one long form. Tabs: "Identity & Source" / "Insights & Hook" / "Engagement" / "Notes". Reduces scroll, focuses the reviewer.

### G5. Skeleton loaders **(P3, XS)**

Replace spinners with content-shaped skeleton placeholders. Perceived-perf win, easy.

### G6. Toast notifications **(P3, XS)**

Today actions show inline status text or alerts. Toasts are less intrusive and more standard.

---

## Cross-cutting suggestion: a single "Operator Health" view

A small fixed sidebar widget on every page showing:
- Leads in queue (pipeline status `Personalized` and not reviewed)
- Leads needing insights (status `New` or `Researching`, no insights)
- Leads ready to push (status `Approved`)
- This week's reply rate
- This week's meeting count

Gives the operator a single glance "what should I do next" signal. Quick win once C1 + C6 land.

---

## Notes

- Items marked **P0** are recommended for the next 1-2 sprints after PR-1 through PR-4 land.
- Anything **P3** is intentionally listed but probably never built — captured here so it's not re-discovered later.
- This doc is a living parking lot. Adding new ideas welcome; just include priority + effort + a one-paragraph sketch.
