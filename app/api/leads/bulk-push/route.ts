/**
 * POST /api/leads/bulk-push
 *
 * Push multiple approved leads to Instantly in a single operation.
 * Each lead is verified through DeBounce first. Only "Safe to Send" leads are
 * enrolled in the specified campaign. On success, the Lead record is updated
 * in place with Instantly IDs, campaign metadata, Pipeline Status "In Campaign",
 * and Initial Outreach Date.
 *
 * Body: { leadIds: string[], campaignId?: string, campaignName?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { getLead } from "@/lib/airtable";
import { verifyEmailWithDeBounce } from "@/lib/debounce";
import { pushLeadToInstantly } from "@/lib/outreach";
import type { Lead } from "@/lib/schema";
import { toErrorResponse } from "@/lib/http/errors";
import {
  JsonObject,
  parseJsonObject,
  readStringArray,
} from "@/lib/http/validation";
import {
  assertBulkPushEligible,
  resolveLeadPushContext,
} from "@/lib/services/push-to-campaign";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface LeadResult {
  id: string;
  name?: string;
  status: "success" | "skipped" | "error";
  reason?: string;
  verification?: Awaited<ReturnType<typeof verifyEmailWithDeBounce>>;
  lead?: Lead;
}

export async function POST(req: NextRequest) {
  try {
    const body: JsonObject = await parseJsonObject(req);
    const leadIds = readStringArray(body, "leadIds", { minLength: 1 });
    const campaignId =
      typeof body.campaignId === "string" ? body.campaignId.trim() : undefined;
    const campaignName =
      typeof body.campaignName === "string" ? body.campaignName.trim() : undefined;

    const results: LeadResult[] = [];

    for (const leadId of leadIds) {
      try {
        const lead = await getLead(leadId);

        if (!lead) {
          results.push({ id: leadId, status: "error", reason: "Lead not found" });
          continue;
        }

        try {
          assertBulkPushEligible(lead);
          resolveLeadPushContext(lead, { campaignId, campaignName });
        } catch (err) {
          results.push({
            id: leadId,
            name: lead.name,
            status: "skipped",
            reason: err instanceof Error ? err.message : "Lead is not eligible for push",
          });
          continue;
        }

        const verification = await verifyEmailWithDeBounce(lead.email ?? "");
        if (verification.decision !== "safe") {
          results.push({
            id: leadId,
            name: lead.name,
            status: "skipped",
            reason:
              verification.error ||
              `DeBounce result: ${verification.result || "unknown"}${
                verification.reason ? ` (${verification.reason})` : ""
              }`,
            verification,
          });
          continue;
        }

        const context = resolveLeadPushContext(lead, { campaignId, campaignName });
        const updatedLead = await pushLeadToInstantly({
          lead,
          campaignId: context.campaignId,
          campaignName: context.campaignName,
        });

        results.push({
          id: leadId,
          name: lead.name,
          status: "success",
          verification,
          lead: updatedLead,
        });
      } catch (err) {
        results.push({
          id: leadId,
          status: "error",
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const successCount = results.filter((r) => r.status === "success").length;
    const errorCount = results.filter((r) => r.status === "error").length;
    const skippedCount = results.filter((r) => r.status === "skipped").length;

    return NextResponse.json({
      results,
      summary: { successCount, errorCount, skippedCount, total: leadIds.length },
    });
  } catch (e) {
    return toErrorResponse(e, "Failed to process bulk push");
  }
}
