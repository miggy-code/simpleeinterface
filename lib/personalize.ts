/**
 * Personalization orchestrator.
 *
 * Implements the "generic-first, personalize when we earn it" contract:
 *   - High confidence  → write the AI's hook to the lead
 *   - Medium / Low / null → write the campaign's defaultHook to the lead
 *   - Fallback provenance is preserved in structured fields so reviewers can
 *     see what was proposed and what default was used.
 *
 * Default hook source of truth: the Instantly campaign's
 * `custom_variables.default_hook`. Cached in-memory for 60s to keep the
 * extra API call negligible at current volume. (At higher volume, swap to
 * Vercel KV or signed URLs — this can grow up to ~50 RPS before the cache
 * is meaningfully bypassed.)
 */

import { generateHook, HookGenerationResult } from "./ai";
import { getInstantlyCampaign } from "./instantly";
import { CampaignHookContext, Lead } from "./schema";

export interface PersonalizationDecision {
  /** Fields that should be PATCHed onto the lead in Airtable. */
  fieldsToUpdate: Partial<Lead>;
  /** Whether we substituted the campaign default instead of the AI's hook. */
  appliedDefault: boolean;
  /** The raw AI generation result (for audit + UI display). */
  generation: HookGenerationResult;
}

// ─── Default-hook cache ─────────────────────────────────────────────────────

const CAMPAIGN_CONTEXT_TTL_MS = 60_000;
const defaultHookCache = new Map<
  string,
  { value: string | null; expiresAt: number }
>();
const campaignContextCache = new Map<
  string,
  { value: CampaignHookContext; expiresAt: number }
>();

async function getCampaignHookContext(
  campaignId: string
): Promise<CampaignHookContext> {
  const cached = campaignContextCache.get(campaignId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const campaign = await getInstantlyCampaign(campaignId);
  const steps =
    campaign.sequences?.[0]?.steps
      ?.filter((step) => step.type === "email" || !step.type)
      .map((step, index) => {
        const variant = step.variants?.[0] ?? {};
        return {
          stepNumber: index + 1,
          subject: variant.subject ?? "",
          body: variant.body ?? "",
        };
      }) ?? [];

  const value: CampaignHookContext = {
    campaignId,
    campaignName: campaign.name,
    defaultHook:
      typeof campaign.custom_variables?.default_hook === "string" &&
      campaign.custom_variables.default_hook.trim()
        ? campaign.custom_variables.default_hook.trim()
        : null,
    steps,
  };
  campaignContextCache.set(campaignId, {
    value,
    expiresAt: now + CAMPAIGN_CONTEXT_TTL_MS,
  });
  return value;
}

/**
 * Fetch the campaign's `custom_variables.default_hook` from Instantly.
 * Caches per-campaign for 60 seconds to amortize the extra API hit.
 * Returns null if the campaign is unknown, the API call fails, or the
 * variable isn't set (caller decides what to write).
 */
export async function getCampaignDefaultHook(
  campaignId: string
): Promise<string | null> {
  const cached = defaultHookCache.get(campaignId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  let value: string | null = null;
  try {
    const campaign = await getInstantlyCampaign(campaignId);
    const raw = campaign.custom_variables?.default_hook;
    value = typeof raw === "string" && raw.trim() ? raw : null;
  } catch (err) {
    console.warn(
      `[personalize] could not fetch defaultHook for campaign ${campaignId}:`,
      err
    );
    value = null;
  }

  defaultHookCache.set(campaignId, {
    value,
    expiresAt: now + CAMPAIGN_CONTEXT_TTL_MS,
  });
  return value;
}

/**
 * Run the AI for a lead and decide what to write back. Does NOT call
 * `updateLead` — the caller does that with the returned `fieldsToUpdate`.
 *
 * Decision logic:
 *   - High confidence + non-null hook    → use AI hook, queue for review
 *   - Medium confidence + non-null hook  → use campaign default, queue for review
 *   - Low / null hook                    → use campaign default, queue for review
 */
export async function decidePersonalization(
  lead: Lead
): Promise<PersonalizationDecision> {
  const effectiveCampaignId = lead.instantlyCampaignId;
  if (!effectiveCampaignId) {
    throw new Error(
      "Lead must be assigned to an Instantly campaign before generating a hook"
    );
  }

  const campaignContext = await getCampaignHookContext(effectiveCampaignId);
  const firstEmail = campaignContext.steps[0];
  if (
    !firstEmail ||
    !`${firstEmail.subject}\n${firstEmail.body}`.includes(
      "{{personalization_hook}}"
    )
  ) {
    throw new Error(
      "Assigned campaign must contain {{personalization_hook}} in its first email before hooks can be generated"
    );
  }

  const generation = await generateHook(lead, campaignContext);
  const campaignDefault = campaignContext.defaultHook ?? null;

  const hook = generation.hook?.trim() ? generation.hook.trim() : null;
  const { confidence } = generation;
  const now = new Date().toISOString();

  // Decision tree
  if (confidence === "High" && hook !== null) {
    // AI earned it — write the specific hook
    return {
      fieldsToUpdate: {
        personalizationHook: hook,
        personalizationConfidence: "High",
        personalizationReviewed: false,
        personalizationHookSource: "AI Specific",
        personalizationAiCandidate: "",
        campaignDefaultHookSnapshot: campaignDefault ?? undefined,
        personalizationNotes: generation.reasoning ?? undefined,
        personalizationGeneratedAt: now,
      },
      appliedDefault: false,
      generation,
    };
  }

  if (confidence === "Medium" && hook !== null) {
    // Decent attempt but not confident enough — use default, queue for review
    const hookToWrite = campaignDefault ?? hook; // fall back to AI hook if no default
    return {
      fieldsToUpdate: {
        personalizationHook: hookToWrite,
        personalizationConfidence: "Medium",
        personalizationReviewed: false,
        personalizationHookSource:
          campaignDefault !== null ? "Campaign Default" : "AI Specific",
        personalizationAiCandidate:
          campaignDefault !== null ? hook : "",
        campaignDefaultHookSnapshot: campaignDefault ?? undefined,
        personalizationNotes: generation.reasoning ?? undefined,
        personalizationGeneratedAt: now,
      },
      appliedDefault: campaignDefault !== null,
      generation,
    };
  }

  // Low confidence or null hook — use campaign default
  const hookToWrite = campaignDefault ?? hook ?? "";
  if (!hookToWrite.trim()) {
    throw new Error(
      "No specific hook was generated and the assigned campaign has no default_hook"
    );
  }
  return {
    fieldsToUpdate: {
      personalizationHook: hookToWrite,
      personalizationConfidence: "Low",
      personalizationReviewed: false,
      personalizationHookSource: campaignDefault !== null ? "Campaign Default" : "AI Specific",
      personalizationAiCandidate: hook ?? "",
      campaignDefaultHookSnapshot: campaignDefault ?? undefined,
      personalizationNotes: generation.reasoning ?? undefined,
      personalizationGeneratedAt: now,
    },
    appliedDefault: campaignDefault !== null,
    generation,
  };
}
