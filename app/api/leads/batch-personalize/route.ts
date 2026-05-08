import { NextRequest, NextResponse } from "next/server";
import { getLeads, updateLead } from "@/lib/airtable";
import { decidePersonalization } from "@/lib/personalize";
import { toErrorResponse, ValidationError } from "@/lib/http/errors";
import { parseJsonObject, readStringArray } from "@/lib/http/validation";

const BATCH_CONCURRENCY = 3; // parallel AI calls per batch

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonObject(req);
    // Accept both `ids` (frontend) and legacy `leadIds`
    let ids: string[];
    if (Array.isArray(body.ids)) {
      ids = readStringArray(body, "ids", { minLength: 1 });
    } else if (Array.isArray(body.leadIds)) {
      ids = readStringArray(body, "leadIds", { minLength: 1 });
    } else {
      throw new ValidationError("ids array is required");
    }

    const leads = await getLeads(ids);

    // Result shape must match the frontend's GenResult type:
    //   { id: string; status: "ok" | "error"; hook?: string; error?: string }
    const results: Array<{
      id: string;
      status: "ok" | "error";
      hook?: string;
      confidence?: string;
      hookSource?: string;
      appliedDefault?: boolean;
      error?: string;
    }> = [];

    // Process in chunks to avoid hammering the AI API
    for (let i = 0; i < leads.length; i += BATCH_CONCURRENCY) {
      const chunk = leads.slice(i, i + BATCH_CONCURRENCY);
      const chunkResults = await Promise.allSettled(
        chunk.map(async (lead) => {
          const decision = await decidePersonalization(lead);
          await updateLead(lead.id, decision.fieldsToUpdate);
          return {
            id: lead.id,
            status: "ok" as const,
            hook: decision.fieldsToUpdate.personalizationHook ?? undefined,
            appliedDefault: decision.appliedDefault,
            confidence: decision.generation.confidence,
            hookSource:
              decision.fieldsToUpdate.personalizationHookSource ?? undefined,
          };
        })
      );

      for (let j = 0; j < chunkResults.length; j++) {
        const r = chunkResults[j];
        const lead = chunk[j];
        if (r.status === "fulfilled") {
          results.push(r.value);
        } else {
          results.push({
            id: lead.id,
            status: "error",
            error: r.reason instanceof Error ? r.reason.message : String(r.reason),
          });
        }
      }
    }

    const summary = {
      total: results.length,
      succeeded: results.filter((r) => r.status === "ok").length,
      failed: results.filter((r) => r.status === "error").length,
      appliedDefault: results.filter((r) => r.appliedDefault).length,
      sourceDist: {
        aiSpecific: results.filter((r) => r.hookSource === "AI Specific").length,
        campaignDefault: results.filter((r) => r.hookSource === "Campaign Default").length,
      },
      confidenceDist: {
        High: results.filter((r) => r.confidence === "High").length,
        Medium: results.filter((r) => r.confidence === "Medium").length,
        Low: results.filter((r) => r.confidence === "Low").length,
      },
    };

    return NextResponse.json({ success: true, summary, results });
  } catch (err) {
    console.error("[batch-personalize]", err);
    return toErrorResponse(err, "Internal server error");
  }
}
