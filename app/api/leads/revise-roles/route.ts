import { NextRequest, NextResponse } from "next/server";
import { getLeads, updateLead } from "@/lib/airtable";
import { toErrorResponse, ValidationError } from "@/lib/http/errors";
import { parseJsonObject, readStringArray } from "@/lib/http/validation";
import { reviseTitlesWithAI } from "@/lib/title-normalization";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonObject(req);
    const leadIds = readStringArray(body, "leadIds", { minLength: 1 });
    const leads = await getLeads(leadIds);
    const byId = new Map(leads.map((lead) => [lead.id, lead]));
    const orderedLeads = leadIds
      .map((id) => byId.get(id))
      .filter((lead): lead is NonNullable<typeof lead> => Boolean(lead));

    if (orderedLeads.length === 0) {
      throw new ValidationError("No matching leads were found");
    }

    const titledLeads = orderedLeads.filter((lead) => lead.title?.trim());
    const revisions = await reviseTitlesWithAI(
      titledLeads.map((lead) => ({
        id: lead.id,
        title: lead.title!.trim(),
      }))
    );
    const revisionsById = new Map(revisions.map((item) => [item.id, item.revisedTitle]));

    const results = [];
    for (const lead of orderedLeads) {
      const previousTitle = lead.title ?? "";
      const revisedTitle = revisionsById.get(lead.id) ?? previousTitle;
      if (revisedTitle === previousTitle) {
        results.push({
          id: lead.id,
          previousTitle,
          revisedTitle,
          changed: false,
          lead,
        });
        continue;
      }

      const updatedLead = await updateLead(lead.id, { title: revisedTitle });
      results.push({
        id: lead.id,
        previousTitle,
        revisedTitle,
        changed: true,
        lead: updatedLead,
      });
    }

    const revisedCount = results.filter((result) => result.changed).length;
    return NextResponse.json({
      results,
      summary: {
        total: results.length,
        revisedCount,
        unchangedCount: results.length - revisedCount,
      },
    });
  } catch (err) {
    return toErrorResponse(err, "Failed to revise roles");
  }
}
