import { ConfigError } from "./http/errors";

const DEBOUNCE_BASE_URL = "https://api.debounce.io/v1/";

export type DeBounceDecision = "safe" | "blocked" | "missing_email" | "error";

export interface DeBounceVerification {
  email: string;
  decision: DeBounceDecision;
  result?: string;
  reason?: string;
  error?: string;
}

interface DeBounceApiResponse {
  success?: string | boolean;
  debounce?: {
    email?: string;
    result?: string;
    reason?: string;
  };
}

function debounceApiKey(): string {
  const key = process.env.DEBOUNCE_API_KEY?.trim();
  if (!key) throw new ConfigError("DEBOUNCE_API_KEY is not set on the server.");
  return key;
}

export function isSafeToSend(result?: string): boolean {
  return result?.trim().toLowerCase() === "safe to send";
}

export async function verifyEmailWithDeBounce(
  email: string
): Promise<DeBounceVerification> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return {
      email: "",
      decision: "missing_email",
      error: "Lead has no email address",
    };
  }

  const params = new URLSearchParams({
    api: debounceApiKey(),
    email: trimmedEmail,
  });
  const res = await fetch(`${DEBOUNCE_BASE_URL}?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    return {
      email: trimmedEmail,
      decision: "error",
      error: `DeBounce ${res.status}: ${text.slice(0, 300)}`,
    };
  }

  const data = (await res.json()) as DeBounceApiResponse;
  const result = data.debounce?.result;
  const reason = data.debounce?.reason;

  return {
    email: data.debounce?.email ?? trimmedEmail,
    result,
    reason,
    decision: isSafeToSend(result) ? "safe" : "blocked",
  };
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
