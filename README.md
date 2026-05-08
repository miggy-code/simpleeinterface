# Throttl Internal Outreach

Operator UI for the simplified internal Throttl outbound workflow. Airtable is
the lead store, DeBounce verifies email safety, and Instantly handles campaign
creation plus lead enrollment.

## What the app does

- `Campaigns` tab: create a Draft Instantly campaign with the fixed Throttl AI toolkit email.
- `Leads` tab: review Airtable leads, assign a campaign, run DeBounce, approve, and bulk push.
- Lead detail page: edit the fields used by the fixed email template and preview the rendered email.

## What it does not do

- It does not source leads or provide in-app lead creation. Lead creation happens outside the app and lands in Airtable.
- It does not generate AI personalization hooks.
- It does not run reengagement/archive automation or engagement-sync cron jobs.
- It does not edit campaign copy per campaign; the sequence is intentionally fixed.

## Tech

- Next.js 14 App Router on Node runtime
- Tailwind CSS, no component library
- Airtable REST API directly via `fetch`
- DeBounce real-time email verification
- Instantly v2 REST API

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local manually
touch .env.local

# 3. Fill in the required secrets
# Airtable:
# - AIRTABLE_API_KEY or AIRTABLE_PAT
# - AIRTABLE_BASE_ID
# - AIRTABLE_LEADS_TABLE_ID
# - AIRTABLE_ARCHIVE_TABLE_ID
#
# Instantly:
# - INSTANTLY_API_KEY
#
# DeBounce:
# - DEBOUNCE_API_KEY
#
# App security:
# - DASHBOARD_USERNAME
# - DASHBOARD_PASSWORD

# 4. Run locally
npm run dev
```

## Key routes

- `/` - simplified internal dashboard
- `/leads/[id]` - lead detail page
- `/api/leads` - list and create leads
- `/api/leads/verify` - verify selected lead emails through DeBounce
- `/api/leads/[id]/push` - push one lead to Instantly
- `/api/leads/bulk-push` - verify and push selected leads to Instantly
- `/api/campaigns` - list campaigns and create the fixed-template campaign

## Workflow summary

1. Create or choose the fixed-template Instantly campaign.
2. Review Airtable leads and fix `First Name`, `Email`, `Title`, `Company Name`, `Company Domain`, and `Industry`.
3. Assign selected leads to the Instantly campaign.
4. Run DeBounce. Only `Safe to Send` leads can be pushed.
5. Approve and push safe leads to Instantly.

## Troubleshooting

- `Couldn't load leads` usually means Airtable credentials are missing or do not have read access.
- DeBounce failures usually mean `DEBOUNCE_API_KEY` is missing or the DeBounce API rejected the request.
- `Push to Instantly` failures usually mean the campaign ID is wrong, required template fields are missing, DeBounce did not return `Safe to Send`, or the Instantly key does not match the workspace.

## Testing

```bash
npm test
npm run typecheck
```

The default suite is deterministic and does not write to Airtable or Instantly.
It focuses on mocked Airtable, DeBounce, and Instantly request contracts.
