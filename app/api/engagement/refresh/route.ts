/**
 * POST /api/engagement/refresh
 *
 * Syncs engagement data from Instantly back to Leads in campaign
 * for all leads that have an Instantly Lead ID. Updates opens, replies,
 * bounces, and unsubscribes.
 *
 * Leads remains the source of truth through initial outreach.
 */
import { NextResponse } from "next/server";
import { runEngagementSync } from "@/lib/services/engagement-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  try {
    const summary = await runEngagementSync({
      batchSize: 1,
      batchDelayMs: 0,
      capErrorDetails: 50,
    });

    return NextResponse.json({
      success: true,
      total: summary.total,
      synced: summary.synced,
      skipped: summary.skipped,
      errors: summary.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
