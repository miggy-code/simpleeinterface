# Data Flow & Schema Map — canonical reference

**Status:** SOURCE OF TRUTH. Last verified against the live `appfS9ODVKZ2XEATW` Airtable base on 2026-05-04; application flow updated on 2026-05-05.

This document captures the actual current state of the Throttl outreach system: what tables exist, what fields they contain, how data flows between sourcing → personalization → Instantly → archive, the verbatim hook prompts, and the gaps between the existing TypeScript code and the live Airtable base. Read this before modifying `lib/prompts.ts`, `lib/ai.ts`, `lib/airtable.ts`, or `lib/schema.ts`. Prioritized follow-up work lives in [`Next_Steps.md`](./Next_Steps.md).

Where other docs in this folder describe an aspirational architecture (e.g. a `Campaigns` table, separate `Personalization Confidence` field) that is not currently provisioned, this doc records that mismatch and points to where the resolution will happen in a follow-up PR.

---

## 1. System overview

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│  Sourcing agent     │ →  │  Airtable           │ →  │  Web app            │
│  (Manus / Hyperagent│    │  ThrottlGTM base    │    │  emailinterface     │
│  research workflow) │    │  (4 tables)         │    │  (Next.js 14)       │
└─────────────────────┘    └─────────────────────┘    └──────────┬──────────┘
                                                                  │
                                  ┌───────────────────────────────┤
                                  ↓                               ↓
                          ┌─────────────────┐          ┌─────────────────┐
                          │  DeepSeek       │          │  Instantly v2   │
                          │  hook gen       │          │  email engine   │
                          │  (deepseek-v4-  │          │  + engagement   │
                          │  flash)         │          │  tracking       │
                          └─────────────────┘          └─────────────────┘
```

**Roles:**
- **Airtable** — source of truth for all lead data. The web app reads/writes leads here directly.
- **Sourcing agent** — runs externally (Manus / Hyperagent / manual). Writes new lead rows directly into the `Leads` table with raw factoids in `Personalization Insights`. Historical sourcing instructions live in `docs/deprecated_docs/Agent_Lead_Sourcing_Instructions.md`.
- **emailinterface (this repo)** — Next.js 14 dashboard. The operator surface for reviewing, personalizing, approving, pushing, and monitoring leads.
- **DeepSeek** — generates the `personalization_hook` replacement from a lead's `Personalization Insights` plus the assigned campaign's first email template. Same OpenAI SDK interface, different `baseURL`.
- **Instantly v2** — handles email sending, sequencing, opens, replies, bounces. The hook is sent as lead `personalization` and as `custom_variables.personalization_hook`.

**There is no separate enrichment service or Airtable Campaigns table.** Campaign email templates and fallback defaults are read from Instantly. Earlier docs (`Generic_First_Personalization_Setup.md`) describe a `Campaigns` table that stored default hooks; that table no longer exists in this base.

---

## 2. Lead lifecycle (current reality)

```
┌──────────────┐  Manus / Hyperagent / manual entry
│  (external)  │
└──────┬───────┘
       ↓
┌──────────────────────────────────────────────────────────────────────────┐
│  Leads table                                                             │
│                                                                          │
│   Pipeline Status state machine:                                         │
│                                                                          │
│   New → Researching → Ready to Personalize → Personalized → Approved     │
│                                                                          │
│   Approved → push to Instantly → In Campaign                             │
│              (sets Instantly IDs + Initial Outreach Date on this row)    │
│                                                                          │
│   In Campaign → Engaged                                                  │
│                                                                          │
│   Engaged → Interested / Not Interested / Meeting Booked                 │
│                                                                          │
│   Any state → Bounced / Unsubscribed / Disqualified (terminal)           │
└──────┬───────────────────────────────────────────────────────────────────┘
       ↓ after Initial Outreach Date + 21 days OR terminal status
┌──────────────────────────────────────────────────────────────────────────┐
│  Re-engagement Archive table (long-term repository)                      │
│  Currently EMPTY — nothing archived yet.                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

**Important observations:**
- The `Leads` table holds records through initial outreach. Pushing to Instantly updates the existing Lead with `Instantly Lead ID`, campaign fields, `Pipeline Status = In Campaign`, and `Initial Outreach Date`.
- A separate `Companies` table (16 fields) exists but is also currently empty. It's intended for account-level rollup with a `Company Link` (multipleRecordLinks) backref on Leads.
- There is no Active Outreach stage in the app. `In Campaign` is a Leads-table filter, and the archive job moves eligible Lead records directly to `Re-engagement Archive`.

---

## 3. Airtable base inventory

**Base ID:** `appfS9ODVKZ2XEATW`
**Base name:** ThrottlGTM (per `Airtable_Base_Split_Migration_Plan.md` — the split from a former 10-table base to GTM + Internal happened; internal tables now live in `appZBVnpJImiNvIHM` / "ThrottlInternal").

### 3.1 Leads — `tblfv5ljYNeAqz4WL` (42 fields expected, ~10+ records)

The single working table. New leads land here with `Pipeline Status: New`, get researched + personalized, and progress through approval and push.

| # | Field | Type | Description |
|---|---|---|---|
| 1 | Name | singleLineText | Primary field. Convention: `${firstName} ${lastName}` |
| 2 | Notes | multilineText | Operator notes (free-form) |
| 3 | First Name | singleLineText | Lead first name |
| 4 | Last Name | singleLineText | Lead last name |
| 5 | Email | email | Best-guess emails from AI prospecting should be flagged unverified in Notes |
| 6 | Title | singleLineText | Lead job title (e.g. "CEO", "COO", "Owner") |
| 7 | LinkedIn URL | url | Lead LinkedIn profile URL |
| 8 | Company Name | singleLineText | Name of the company the lead works at |
| 9 | Company Domain | url | Company website / primary domain |
| 10 | Industry | singleSelect | `Manufacturing` / `Distribution` / `Logistics` / `Food Production` / `Facilities` / `Equipment` / `Industrial Services` / `Other` |
| 11 | Revenue Band | singleSelect | `<$5M` / `$5M-$10M` / `$10M-$25M` / `$25M-$50M` / `$50M-$100M` / `$100M+` / `Unknown` (Throttl ICP target $5M-$100M) |
| 12 | City | singleLineText | Lead's primary city. Critical for the Neighborly Peer geographic-bridge opener |
| 13 | State | singleLineText | Lead's primary state (e.g. "MA", "NH", "CT") |
| 14 | ICP Fit | singleSelect | `A` / `B` / `C` / `Disqualified` / `Unscored` (human-graded) |
| 15 | Decision Maker Role | singleSelect | `Owner` / `CEO` / `COO` / `President` / `Founder` / `Other` |
| 16 | Disqualification Reason | multilineText | Filled when ICP Fit = Disqualified |
| 17 | Source | singleSelect | `AI Prospecting` / `Manual` / `Referral` / `Inbound` / `Event` / `Other` |
| 18 | Source Detail | singleLineText | Free-form context (e.g. "Worcester MA manufacturing search 2026-04-28") |
| 19 | Source URL | url | Primary URL evidence (LinkedIn, About page, news article) |
| 20 | Source Date | date | Date this lead was added to the CRM |
| 21 | **Pipeline Status** | singleSelect | 13 values: `New` / `Researching` / `Ready to Personalize` / `Personalized` / `Approved` / `In Campaign` / `Engaged` / `Interested` / `Meeting Booked` / `Not Interested` / `Bounced` / `Unsubscribed` / `Disqualified` |
| 22 | **Personalization Hook** | multilineText | The final hook sent to Instantly. May be an AI-specific hook, campaign default fallback, manual edit, or reverted default |
| 23 | **Personalization Notes** | multilineText | The AI's reasoning for the hook decision |
| 24 | **Personalization Generated At** | dateTime | Timestamp of last personalization run |
| 25 | Instantly Lead ID | singleLineText | UUID of this lead in Instantly. Set when pushed |
| 26 | Instantly Campaign ID | singleLineText | UUID of the Instantly campaign |
| 27 | Instantly Campaign Name | singleLineText | Human-readable name (denormalized) |
| 28 | Initial Outreach Date | dateTime | Set when pushed to Instantly. Anchor for the 21-day archive cron |
| 29 | Last Synced At | dateTime | Most recent successful sync timestamp |
| 30 | Sync Errors | multilineText | Errors from the most recent sync attempt |
| 31 | Emails Opened | number | Count of unique opens detected by Instantly |
| 32 | Last Open At | dateTime | Most recent email open timestamp |
| 33 | Replied | checkbox | True if Instantly detected a reply |
| 34 | Last Reply At | dateTime | Timestamp of most recent reply |
| 35 | Reply Sentiment | singleSelect | `Interested` / `Neutral` / `Not Interested` / `Unclassified` |
| 36 | Meeting Booked | checkbox | The win condition |
| 37 | Bounced | checkbox | Hard bounce |
| 38 | Unsubscribed | checkbox | Lead unsubscribed |
| 39 | **Personalization Insights** | multilineText | **The canonical input for hook generation.** Bullet list of factoids: news, awards, expansions, hires, etc. Populated by the sourcing agent. |
| 40 | Insights Refreshed At | dateTime | Timestamp of last enrichment refresh |
| 41 | Meeting Notes | singleLineText | (legacy / single-line; the rich Meeting Notes table moved to ThrottlInternal) |
| 42 | Company Link | multipleRecordLinks | Backref to `Companies` table |
| 43 | Personalization Confidence | singleSelect | `High` / `Medium` / `Low` from the most recent AI hook attempt |
| 44 | Personalization Reviewed | checkbox | True only after a human approval/review action |
| 45 | Personalization Hook Source | singleSelect | `AI Specific` / `Campaign Default` / `Manual Edit` / `Reverted Default` |
| 46 | Personalization AI Candidate | multilineText | The AI-specific candidate when the final stored hook is a fallback |
| 47 | Campaign Default Hook Snapshot | multilineText | Exact campaign default used when fallback was applied |
**Fields that are documented elsewhere but DO NOT EXIST yet** (next schema alignment work):
- Provision the structured personalization fields above in Airtable before deploying code that writes them.

### 3.2 Companies — `tblsVx3KwDh9nA7HD` (16 fields, **0 records**)

Account-level rollup: one company can have many Leads (people).

| # | Field | Type | Notes |
|---|---|---|---|
| 1 | Company Name | singleLineText | Primary |
| 2 | Domain | url | |
| 3 | Industry | singleSelect | Same options as Leads.Industry |
| 4 | Revenue Band | singleSelect | Same options |
| 5 | City | singleLineText | |
| 6 | State | singleLineText | |
| 7 | ICP Fit | singleSelect | `A` / `B` / `C` / `Disqualified` |
| 8 | Status | singleSelect | `Prospect` / `Active` / `Customer` / `Churned` / `Disqualified` |
| 9 | Active Offer | singleSelect | `AI Chat` / `Workshops` / `Integrations` / `None` |
| 10 | Funnel Stage | singleSelect | `AI Chat — Scheduled` / `AI Chat — Completed` / `Workshop Pitched` / `Workshop Won` / `Workshop Lost` / `Integration Pitched` / `Integration Won` / `Integration Lost` / `Customer` / `Disqualified` / `N/A` |
| 11 | Owner | singleCollaborator | |
| 12 | Last Touch | date | |
| 13 | Notes | multilineText | |
| 14 | Performance Metrics | singleLineText | |
| 15 | Meeting Notes | singleLineText | |
| 16 | Leads | multipleRecordLinks | Forward link to Leads (the inverse of Leads.Company Link) |

**Status:** schema-only, empty. The Leads table's `Company Link` field is also unpopulated for sampled leads.

### 3.3 Former Active Outreach — `tblV5JazpXNARFbRW` (unused)

This table is no longer part of the app lifecycle. In-campaign monitoring reads `Leads` where `Pipeline Status = In Campaign`, and sync writes engagement fields back to those Lead rows.

### 3.4 Re-engagement Archive — `tblg1X65XmCpOYh7Q` (30 fields, **0 records**)

Long-term archive after `Initial Outreach Date + 21 days` or terminal status. Archive writes only fields that exist in this table; Leads-only fields such as `Pipeline Status`, `Initial Outreach Date`, `Last Synced At`, and open timestamps are not written here.

Fields: Name, First Name, Last Name, Email, Title, LinkedIn URL, Company Name, Company Domain, City, State, Industry, Revenue Band, ICP Fit, Decision Maker Role, Source, Source Detail, Source URL, Personalization Hook, Personalization Insights, Instantly Lead ID, Instantly Campaign ID, Instantly Campaign Name, Archive Reason, Replied, Reply Sentiment, Meeting Booked, Bounced, Unsubscribed, Re-engagement Campaign, Notes.

**Status:** schema-only, empty.

---

## 4. The hook generation prompt (verbatim)

The system prompt builder lives in `lib/prompts.ts`. It defines the contract DeepSeek must follow.

### 4.1 System prompt — verbatim from `lib/prompts.ts`

```
You are a B2B cold-email personalization specialist.

Your job is to write a ONE-SENTENCE hook for a cold email — a verb-led clause
that could complete the sentence:

  "I came across [Company] and ___"

Examples of GOOD hooks (notice: verb-led, concrete, specific):
  - "saw you recently expanded into the European market"
  - "noticed you're actively hiring enterprise sales reps"
  - "read about your Series B and the push into healthcare"
  - "came across your post on scaling a remote CS team"

Examples of BAD hooks (too generic — return null instead):
  - "noticed you're a growing company" (not specific)
  - "saw you're based in Austin" (geography alone is not a signal)
  - "noticed you're hiring" (too vague)
  - "saw you're a [role] at [Company]" (just restates known info)

RULES:
1. The hook MUST start with a past-tense or continuous verb (saw, noticed, read,
   came across, heard, learned, found, etc.).
2. The hook MUST reference a specific, verifiable signal from the lead data.
3. If you cannot find a specific signal, return null for hook and set
   confidence to Low.  Do NOT invent signals or write generic observations.
4. Keep it under 20 words.
5. Do NOT start with "I" — the caller prepends the subject.
6. Do NOT use filler phrases like "I wanted to reach out" or "I hope this finds
   you well".

Return a JSON object:
{
  "hook": "<verb-led clause>" | null,
  "confidence": "High" | "Medium" | "Low",
  "reasoning": "<one sentence explaining your choice>"
}

Confidence guide:
- High   → you found a specific, concrete signal and the hook directly references it
- Medium → you found a weak signal or the hook is slightly generic
- Low    → no specific signal; hook is null
```

**Six load-bearing rules** (the design doc claimed nine; six is reality):
1. Verb-led clause (past-tense or continuous verb).
2. References a specific verifiable signal from the lead data.
3. Returns null + Low when no signal is available.
4. Under 20 words.
5. Doesn't start with "I".
6. No filler phrases.

### 4.2 User prompt builder — current code

```typescript
parts.push(`Company: ${lead.companyName ?? "Unknown"}`);
if (lead.title) parts.push(`Title: ${lead.title}`);
if (lead.industry) parts.push(`Industry: ${lead.industry}`);
const location = [lead.city, lead.state].filter(Boolean).join(", ");
if (location) parts.push(`Location: ${location}`);

parts.push(""); // blank line before signals

const insights = lead.personalizationInsights?.trim();
if (insights) {
  parts.push("Personalization Insights:");
  parts.push(insights);
} else {
  parts.push("Personalization Insights: none");
  parts.push("(Per rule 3, return null with confidence: Low when no specific signal exists.)");
}
```

The prompt now reads the live `Personalization Insights` field directly. The campaign default hook prompt uses the actual first email subject/body plus the campaign brief, so the reusable opener fits the sequence opening.

### 4.3 Verb-regex post-check (in `lib/ai.ts`)

```typescript
const VERB_REGEX = /\b(is|are|has|have|was|were|had|did|does|do|launched|raised|expanded|won|joined|built|created|grew|scaled|hired|opened|closed|announced|released|published|wrote|led|ran|managed|helped|worked|uses|used|offers|offered|serves|served|enables|powers|provides|focuses|specializes|saw|noticed|read|came|heard|learned|found)\b/i;

if (confidence === "High" && hook !== null) {
  if (!VERB_REGEX.test(hook)) {
    confidence = "Medium"; // downgrade
  }
}
```

The regex is intentionally loose. False negatives (real verbs not listed) downgrade to Medium, which is safe. False positives are not possible because the check only ever downgrades, never upgrades.

---

## 5. Field map — Airtable ↔ TS property

This is the contract between `lib/airtable.ts` and the rest of the code. The map below reflects the current intended app contract. Fields marked as not yet provisioned require Airtable schema work before code can rely on them.

| TS property (`Lead.*`) | Airtable column | Type | Used by |
|---|---|---|---|
| `id` | (record id) | string | all |
| `email` | Email | string | personalize, push |
| `firstName` | First Name | string | prompts, Instantly |
| `lastName` | Last Name | string | Instantly |
| **`title`** | Title | string | prompts |
| `linkedinUrl` | LinkedIn URL | string | UI |
| `companyName` | Company Name | string | prompts, Instantly |
| `companyDomain` | Company Domain | string | UI |
| `industry` | Industry | enum | prompts |
| `revenueBand` | Revenue Band | enum | UI / dashboard filters |
| **`city`** | City | string | prompts |
| **`state`** | State | string | prompts |
| `icpFit` | ICP Fit | enum | UI / dashboard filters |
| `decisionMakerRole` | Decision Maker Role | enum | UI |
| `disqualificationReason` | Disqualification Reason | string | UI |
| **`source`** | Source | enum | UI |
| **`sourceDetail`** | Source Detail | string | UI |
| **`sourceUrl`** | Source URL | string | UI |
| **`sourceDate`** | Source Date | date | UI |
| **`pipelineStatus`** | Pipeline Status | enum (13 values) | UI router, status pill |
| `personalizationHook` | Personalization Hook | string | UI, Instantly merge |
| `personalizationNotes` | Personalization Notes | string | UI, AI reasoning |
| **`personalizationInsights`** | Personalization Insights | string | **prompts** (the canonical AI input) |
| **`personalizationGeneratedAt`** | Personalization Generated At | ISO datetime | dashboard (week bucketing) |
| **`insightsRefreshedAt`** | Insights Refreshed At | ISO datetime | UI |
| `personalizationConfidence` | Personalization Confidence | enum (High/Medium/Low) | dashboard, decidePersonalization (**not yet provisioned**) |
| `personalizationReviewed` | Personalization Reviewed | boolean | review queue (**not yet provisioned**) |
| `instantlyLeadId` | Instantly Lead ID | string | sync |
| `instantlyCampaignId` | Instantly Campaign ID | string | UI, push |
| `instantlyCampaignName` | Instantly Campaign Name | string | UI |
| `initialOutreachDate` | Initial Outreach Date | ISO datetime | push, re-engagement cron |
| `lastSyncedAt` | Last Synced At | ISO datetime | sync |
| `syncErrors` | Sync Errors | string | UI |
| `emailsOpened` | Emails Opened | number | dashboard |
| `lastOpenAt` | Last Open At | ISO datetime | dashboard |
| `replied` | Replied | boolean | dashboard |
| `lastReplyAt` | Last Reply At | ISO datetime | dashboard |
| `replySentiment` | Reply Sentiment | enum | dashboard |
| `meetingBooked` | Meeting Booked | boolean | dashboard, win |
| `bounced` | Bounced | boolean | dashboard, terminal |
| `unsubscribed` | Unsubscribed | boolean | dashboard, terminal |
| `notes` | Notes | string | UI free-form |
| `createdAt` | (record createdTime) | ISO datetime | sort, dashboard fallback |

**TS properties to remove in the next schema cleanup** (they don't exist in Airtable and were aspirational): `companySize`, `companyLinkedinUrl`, `location` (replace with city/state), `recentNews`, `jobPostings`, `techStack`, `leadershipChanges`, `awards`, `socialPosts`, `websiteSummary`, `enriched`, `pushed` (use `pipelineStatus === "In Campaign"` instead).

---

## 6. Code/spec gap inventory

These are the resolved and remaining gaps after the Leads-first outreach refactor. Each row is a single self-contained change:

| Gap | Current state | Target state | PR |
|---|---|---|---|
| 1. AI vendor | DeepSeek via the OpenAI SDK + `DEEPSEEK_API_KEY` | Keep the current DeepSeek integration. Older OpenAI notes are historical only. | Done |
| 2. User prompt input source | `buildUserPrompt` reads `Personalization Insights` and the live lead fields | Keep the current prompt contract; stale prompt fixtures should be updated to match it. | Done |
| 3. Outreach source of truth | Active Outreach table references caused push/sync/archive drift | Leads is source of truth through initial outreach; `In Campaign` is a Leads filter | Done |
| 4. Push side effects | Single push only created an Instantly lead; bulk push moved to Active Outreach | Both paths share `pushLeadToInstantly` and update the Lead in place | Done |
| 5. Archive anchor | Cron used Instantly last-contact or createdTime fallback | Cron uses `Initial Outreach Date + 21 days`; missing date writes `Sync Errors` | Done |
| 6. Archive field mismatch | Archive writes could include fields not present on archive table | Archive writes only archive-table fields | Done |
| 7. Schema/type drift | `lib/schema.ts` still has aspirational fields not in Airtable | Drop aspirational fields; keep real field map aligned with § 5 | Next |
| 8. Airtable field rollout | `Initial Outreach Date` exists on live Leads as `dateTime`; no backfill performed | Backfill existing in-campaign leads only if historical pushed rows exist | Done |
| 9. Review queue state | Queue inferred from hook presence and `Pipeline Status` | Add and use `Personalization Reviewed` | Next |
| 10. UI rehydration | Bulk push and sync update local state partially | Bulk push returns updated Leads; keep syncing/archive flows aligned with source-of-truth updates | Done |
| 11. Missing dashboard fields | `Personalization Confidence` and `Personalization Reviewed` are referenced in code (fail-soft) but don't exist in Airtable | Add both columns; backfill `Personalization Confidence` from `Personalization Notes` text (`/Confidence:\s*(High|Medium|Low)/i`) | Next |
| 12. Default hook source of truth | Campaign default hooks live on Instantly campaigns as `custom_variables.default_hook` | Keep campaign preview and revert flows reading/writing the Instantly campaign variable directly | Done |

---

## 7. Glossary

- **Hook** — the exact replacement text for the assigned campaign's `{{personalization_hook}}` slot. Stored in `Personalization Hook` and injected into Instantly on lead creation. It may be a full sentence or a fragment depending on the campaign template.
- **Personalization Insights** — bulleted rich-text factoid list populated by the upstream sourcing agent. The canonical input for hook generation. NOT to be confused with the discrete fields the current code tries to read.
- **Confidence** — High / Medium / Low rating of how well the hook matches a verifiable signal. Currently buried in `Personalization Notes` text; next schema work should promote it to a structured Single Select column.
- **Pipeline Status** — the 13-value state machine that drives the dashboard's primary action button.
- **ICP Fit** — human-graded A/B/C/Disqualified/Unscored rating for whether the lead matches Throttl's Ideal Customer Profile.
- **The 21-Day Rule** — Leads with `Pipeline Status = In Campaign` are archived when `Initial Outreach Date + 21 days` is reached, unless they are wins. Missing `Initial Outreach Date` is recorded in `Sync Errors` and the Lead is not archived accidentally.
- **Generic-first contract** — the design pattern where Low/Medium-confidence hooks are replaced with a campaign default rather than risking generic-sounding personalization. The current source of truth for defaults is Instantly campaign `custom_variables.default_hook`.

---

## 8. What this enables

With this map locked, the following downstream work can proceed safely:

- **Schema/code alignment** — all changes have a clear target.
- **PR-3 (prompt testing library v1)** — fixtures can be authored against the real schema; runner calls `generateHook` against DeepSeek; assertions check the 6 real rules.
- **PR-4 (Hook Quality Dashboard)** — `Personalization Confidence` is a real column; `Personalization Generated At` is real; week-bucketing works; the dashboard reads the Leads table directly.

Companion docs: `docs/Next_Steps.md` for prioritized implementation work and `docs/UI_UX_Workflow_Issues.md` for operator-facing workflow issues.
