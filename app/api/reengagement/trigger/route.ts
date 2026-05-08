/**
 * POST /api/reengagement/trigger
 *
 * Scans Leads with Pipeline Status "In Campaign" and moves eligible leads to
 * the Re-engagement Archive
 * when either:
 *   1. 21 days have passed since Initial Outreach Date,
 *      and the lead has not replied or booked a meeting.
 *   2. The lead has a terminal engagement status (Bounced, Unsubscribed).
 *
 * This route is designed to be called by a scheduled job (cron) or manually
 * from the dashboard. It is idempotent — running it multiple times is safe.
 *
 * Returns a summary of how many leads were moved.
 */
import { NextResponse } from "next/server";
import { runReengagementJob } from "@/lib/services/reengagement";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const results = await runReengagementJob({
      reengagementDays: 21,
      includeMovedLeads: false,
      annotateLeadErrors: true,
    });

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

// Allow GET for easy manual triggering from browser
export async function GET() {
  return POST();
}
