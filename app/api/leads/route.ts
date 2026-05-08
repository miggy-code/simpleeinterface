/**
 * GET /api/leads          — list all leads (optionally filter by status)
 * POST /api/leads         — create a new lead
 */
import { NextRequest, NextResponse } from "next/server";
import {
  createLead,
  findLeadByEmailOrDomain,
  listLeads,
} from "@/lib/airtable";
import { Lead, FIELD_NAME } from "@/lib/schema";
import {
  ValidationError,
  toErrorResponse,
} from "@/lib/http/errors";
import {
  parseJsonObject,
  readOptionalString,
} from "@/lib/http/validation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const filter = status
      ? `{${FIELD_NAME.pipelineStatus}}='${status.replace(/'/g, "''")}'`
      : undefined;

    const leads = await listLeads({
      filterByFormula: filter,
      sort: [{ field: FIELD_NAME.sourceDate, direction: "desc" }],
    });
    return NextResponse.json({ leads });
  } catch (e) {
    return toErrorResponse(e, "Failed to load leads");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await parseJsonObject(req)) as Partial<Lead>;
    const companyName =
      readOptionalString(body as Record<string, unknown>, "companyName") ?? "";
    const email = readOptionalString(body as Record<string, unknown>, "email");
    const name = readOptionalString(body as Record<string, unknown>, "name");
    const companyDomain = readOptionalString(
      body as Record<string, unknown>,
      "companyDomain"
    );
    if (!companyName.trim() || (!email?.trim() && !name?.trim())) {
      throw new ValidationError("companyName and (email or name) are required");
    }
    // Dedup check
    const dup = await findLeadByEmailOrDomain(email, companyDomain);
    if (dup) {
      return NextResponse.json(
        { error: "Duplicate lead", existingLead: dup },
        { status: 409 }
      );
    }
    const lead = await createLead(body);
    return NextResponse.json({ lead }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e, "Failed to create lead");
  }
}
