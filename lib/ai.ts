/**
 * AI hook generation — DeepSeek backend.
 *
 * Uses the OpenAI SDK against DeepSeek's OpenAI-compatible endpoint
 * (`https://api.deepseek.com`). DeepSeek-V4 family is the current generation;
 * `deepseek-chat` and `deepseek-reasoner` are legacy aliases that map to
 * non-thinking and thinking modes of `deepseek-v4-flash` respectively
 * (deprecation: 2026-07-24).
 *
 * Requires:
 *   DEEPSEEK_API_KEY   — provisioned at https://platform.deepseek.com/api_keys
 *   DEEPSEEK_MODEL     — optional; defaults to `deepseek-v4-flash`
 */

import OpenAI from "openai";
import { CampaignHookContext, Lead } from "./schema";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import type { HookGenerationResult } from "./schema";

export type { HookGenerationResult };

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
let deepseekClient: OpenAI | null = null;

function getDeepseekModel(): string {
  return process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
}

function getDeepseekClient(): OpenAI {
  if (deepseekClient) return deepseekClient;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn(
      "[ai] DEEPSEEK_API_KEY is not set — generateHook will fail soft and return Low/null."
    );
  }

  deepseekClient = new OpenAI({
    apiKey: apiKey ?? "missing",
    baseURL: DEEPSEEK_BASE_URL,
  });
  return deepseekClient;
}

export async function generateHook(
  lead: Lead,
  campaignContext: CampaignHookContext
): Promise<HookGenerationResult> {
  const deepseek = getDeepseekClient();
  const DEEPSEEK_MODEL = getDeepseekModel();
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(lead, campaignContext);

  let raw: string;
  try {
    const res = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });
    raw = res.choices[0]?.message?.content ?? "{}";
    console.info(
      `[ai] DeepSeek hook generated: model=${DEEPSEEK_MODEL} ` +
        `tokens_in=${res.usage?.prompt_tokens ?? "?"} ` +
        `tokens_out=${res.usage?.completion_tokens ?? "?"}`
    );
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? (err as { status?: number }).status : undefined;
    const message =
      typeof err === "object" && err && "message" in err
        ? String((err as { message?: string }).message)
        : String(err);
    console.error(
      `[ai] DeepSeek call failed${status ? ` (${status})` : ""}: ${message}`
    );
    // Fail soft — return Low confidence so the system uses the campaign default
    return {
      hook: null,
      confidence: "Low",
      reasoning: "DeepSeek call failed",
    };
  }

  let parsed: Partial<HookGenerationResult>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[ai] Failed to parse AI response");
    return {
      hook: null,
      confidence: "Low",
      reasoning: "Unparseable AI response",
    };
  }

  const hook = parsed.hook ?? null;
  let confidence: HookGenerationResult["confidence"] =
    parsed.confidence ?? "Low";
  const reasoning = parsed.reasoning;

  return { hook, confidence, reasoning };
}
