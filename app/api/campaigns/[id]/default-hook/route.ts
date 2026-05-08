import { NextRequest, NextResponse } from "next/server";
import { setInstantlyCampaignCustomVariables } from "@/lib/instantly";
import { ValidationError, toErrorResponse } from "@/lib/http/errors";
import { parseJsonObject, readString } from "@/lib/http/validation";

export const dynamic = "force-dynamic";

interface DefaultHookBody {
  defaultHook?: string;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await parseJsonObject(req)) as DefaultHookBody;
    const defaultHook = readString(
      body as Record<string, unknown>,
      "defaultHook"
    ).trim();

    if (!defaultHook) {
      throw new ValidationError("defaultHook must be a non-empty string");
    }

    await setInstantlyCampaignCustomVariables(params.id, {
      default_hook: defaultHook,
    });

    return NextResponse.json({ ok: true, defaultHook });
  } catch (err) {
    console.error("[campaigns:default-hook:patch]", err);
    return toErrorResponse(err, "Failed to save default hook");
  }
}
