import { NextRequest, NextResponse } from "next/server";
import { getLead, updateLead } from "@/lib/airtable";
import { decidePersonalization } from "@/lib/personalize";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const lead = await getLead(id);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const decision = await decidePersonalization(lead);
    const updated = await updateLead(id, decision.fieldsToUpdate);

    return NextResponse.json({
      success: true,
      lead: updated,
      appliedDefault: decision.appliedDefault,
      generation: decision.generation,
    });
  } catch (err) {
    console.error("[personalize]", err);
    if (
      err instanceof Error &&
      (err.message.includes("assigned to an Instantly campaign") ||
        err.message.includes("{{personalization_hook}}") ||
        err.message.includes("default_hook"))
    ) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
