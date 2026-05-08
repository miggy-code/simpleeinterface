/**
 * GET /api/cron/reengagement
 *
 * Vercel Cron Job endpoint — runs nightly at 5:00 AM UTC.
 * Calls the re-engagement trigger logic to move leads that have
 * completed the 21-day sequence into the Re-engagement Archive.
 *
 * Protected by CRON_SECRET to prevent unauthorized triggering.
 * Vercel automatically sends the Authorization header when invoking crons.
 *
 * Schedule: 0 5 * * * (5:00 AM UTC daily = midnight EST)
 */
import { NextRequest, NextResponse } from "next/server";
import { runReengagementJob } from "@/lib/services/reengagement";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — allow time for large lists

export async function GET(req: NextRequest) {
  // Verify the request is from Vercel Cron or an authorized caller
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();

  try {
    const summary = await runReengagementJob({
      reengagementDays: 21,
      includeMovedLeads: true,
      annotateLeadErrors: true,
    });

    const response = {
      success: true,
      startedAt,
      completedAt: new Date().toISOString(),
      checked: summary.checked,
      moved: summary.moved,
      errors: summary.errors.length,
      movedLeads: summary.movedLeads,
    };

    console.log("[cron/reengagement] Completed:", response);
    return NextResponse.json(response);
  } catch (err) {
    console.error("[cron/reengagement] Fatal error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        startedAt,
        checked: 0,
        moved: 0,
        errors: 1,
      },
      { status: 500 }
    );
  }
}
