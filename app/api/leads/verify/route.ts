import { NextRequest, NextResponse } from "next/server";
import { getLeads } from "@/lib/airtable";
import {
  mapWithConcurrency,
  verifyEmailWithDeBounce,
  type DeBounceVerification,
} from "@/lib/debounce";
import { toErrorResponse } from "@/lib/http/errors";
import {
  parseJsonObject,
  readStringArray,
  type JsonObject,
} from "@/lib/http/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export interface LeadVerificationResult {
  id: string;
  name?: string;
  email?: string;
  verification: DeBounceVerification;
}

export async function POST(req: NextRequest) {
  try {
    const body: JsonObject = await parseJsonObject(req);
    const leadIds = readStringArray(body, "leadIds", { minLength: 1 });
    const leads = await getLeads(leadIds);
    const byId = new Map(leads.map((lead) => [lead.id, lead]));

    const results = await mapWithConcurrency(leadIds, 5, async (leadId) => {
      const lead = byId.get(leadId);
      if (!lead) {
        return {
          id: leadId,
          verification: {
            email: "",
            decision: "error" as const,
            error: "Lead not found",
          },
        };
      }
      return {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        verification: await verifyEmailWithDeBounce(lead.email ?? ""),
      };
    });

    return NextResponse.json({ results });
  } catch (err) {
    return toErrorResponse(err, "Failed to verify leads with DeBounce");
  }
}
