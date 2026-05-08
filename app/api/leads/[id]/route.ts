/**
 * GET /api/leads/:id          — fetch one lead
 * PATCH /api/leads/:id        — update fields
 * DELETE /api/leads/:id       — hard-delete from Airtable (permanent)
 */
import { NextRequest, NextResponse } from "next/server";
import { deleteLead, getLead, updateLead } from "@/lib/airtable";
import { Lead } from "@/lib/schema";
import { toErrorResponse } from "@/lib/http/errors";
import { parseJsonObject } from "@/lib/http/validation";
import { prepareLeadUpdateWithCampaignAssignment } from "@/lib/campaign-assignment";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const lead = await getLead(params.id);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ lead });
  } catch (e) {
    return toErrorResponse(e, "Failed to fetch lead");
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await parseJsonObject(req)) as Partial<Lead>;
    const update = await prepareLeadUpdateWithCampaignAssignment(body);
    const lead = await updateLead(params.id, update);
    return NextResponse.json({ lead });
  } catch (e) {
    return toErrorResponse(e, "Failed to update lead");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await deleteLead(params.id);
    return NextResponse.json({ deleted: true, id: params.id });
  } catch (e) {
    return toErrorResponse(e, "Failed to delete lead");
  }
}
