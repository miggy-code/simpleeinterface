/**
 * Backfill `Personalization Confidence` column on Airtable Leads from the
 * `Personalization Notes` text.
 *
 * Run once after the column is provisioned (the create-field call lives in
 * docs/Schema_Migration.md / was performed in the PR that added this script).
 *
 * Usage:
 *   AIRTABLE_API_KEY=pat... npx tsx scripts/backfill-personalization-confidence.ts
 *
 * Optional flags via env:
 *   DRY_RUN=1   — print what would be updated, don't write
 *   LIMIT=N     — only inspect the first N records (debugging)
 *
 * Idempotent: skips records that already have a Personalization Confidence value.
 */

import "dotenv/config";
import Airtable from "airtable";

const BASE_ID = process.env.AIRTABLE_BASE_ID ?? "appfS9ODVKZ2XEATW";
const LEADS_TABLE =
  process.env.AIRTABLE_LEADS_TABLE_ID ?? "tblfv5ljYNeAqz4WL";
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : undefined;

const NOTES_FIELD = "Personalization Notes";
const CONFIDENCE_FIELD = "Personalization Confidence";

const CONFIDENCE_RE = /Confidence:\s*(High|Medium|Low)\b/i;

type Confidence = "High" | "Medium" | "Low";
const TITLE_CASE: Record<string, Confidence> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

async function main() {
  if (!process.env.AIRTABLE_API_KEY) {
    console.error("AIRTABLE_API_KEY is not set.");
    process.exit(1);
  }

  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    BASE_ID
  );
  const table = base(LEADS_TABLE);

  console.log(
    `[backfill] base=${BASE_ID} table=${LEADS_TABLE}${
      DRY_RUN ? " (DRY_RUN)" : ""
    }${LIMIT ? ` limit=${LIMIT}` : ""}`
  );

  const records = await table
    .select({
      maxRecords: LIMIT,
      // Keep the payload light — we only need notes + the existing confidence cell.
      fields: [NOTES_FIELD, CONFIDENCE_FIELD],
    })
    .all();

  console.log(`[backfill] scanned ${records.length} records`);

  let parsedCount = 0;
  let skippedAlreadyHas = 0;
  let skippedNoNotes = 0;
  let skippedNoMatch = 0;

  const updates: { id: string; fields: Record<string, string> }[] = [];

  for (const r of records) {
    const existing = r.get(CONFIDENCE_FIELD) as string | undefined;
    if (existing && existing.trim()) {
      skippedAlreadyHas++;
      continue;
    }

    const notes = r.get(NOTES_FIELD) as string | undefined;
    if (!notes) {
      skippedNoNotes++;
      continue;
    }

    const m = notes.match(CONFIDENCE_RE);
    if (!m) {
      skippedNoMatch++;
      continue;
    }

    const confidence = TITLE_CASE[m[1].toLowerCase()];
    if (!confidence) {
      skippedNoMatch++;
      continue;
    }

    parsedCount++;
    updates.push({ id: r.id, fields: { [CONFIDENCE_FIELD]: confidence } });
  }

  console.log(
    `[backfill] summary: parsed=${parsedCount} alreadyHas=${skippedAlreadyHas} noNotes=${skippedNoNotes} noMatch=${skippedNoMatch}`
  );

  if (DRY_RUN) {
    for (const u of updates.slice(0, 5)) {
      console.log(`  [dry-run] ${u.id} → ${JSON.stringify(u.fields)}`);
    }
    return;
  }

  // Airtable's batch update accepts up to 10 records at a time.
  const BATCH = 10;
  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH);
    await table.update(chunk);
    console.log(
      `[backfill] updated ${Math.min(i + BATCH, updates.length)}/${updates.length}`
    );
  }

  console.log("[backfill] done");
}

main().catch((err) => {
  console.error("[backfill] error:", err);
  process.exit(1);
});
