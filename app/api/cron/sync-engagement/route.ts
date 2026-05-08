/**
 * GET /api/cron/sync-engagement
 *
 * Vercel Cron Job endpoint — runs 3x per weekday (10 AM, 2 PM, 6 PM UTC).
 * Syncs engagement data (opens, replies, bounces, unsubscribes) from Instantly
 * back to Leads in Airtable.
 *
 * Uses batched parallel processing to handle large lead lists efficiently.
 * Protected by CRON_SECRET.
 *
 * Schedule: 0 10,14,18 * * 1-5 (Mon–Fri, 10 AM / 2 PM / 6 PM UTC)
 */
import { NextRequest, NextResponse } from "next/server";
import { runEngagementSync } from "@/lib/services/engagement-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH_SIZE = 10; // Process 10 leads in parallel at a time
const BATCH_DELAY_MS = 200;

export async function GET(req: NextRequest) {
  // Verify the request is from Vercel Cron or an authorized caller
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();

  try {
    const summary = await runEngagementSync({
      batchSize: BATCH_SIZE,
      batchDelayMs: BATCH_DELAY_MS,
      capErrorDetails: 10,
    });

    const response = {
      success: true,
      startedAt,
      completedAt: new Date().toISOString(),
      total: summary.total,
      synced: summary.synced,
      skipped: summary.skipped,
      errors: summary.errors.length,
      errorDetails: summary.cappedErrorDetails,
    };

    console.log("[cron/sync-engagement] Completed:", response);
    return NextResponse.json(response);
  } catch (err) {
    console.error("[cron/sync-engagement] Fatal error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        startedAt,
        synced: 0,
        errors: [],
      },
      { status: 500 }
    );
  }
}
