"use client";

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function parseResponseBody(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json().catch(() => null);
  }
  const text = await res.text().catch(() => "");
  return text || null;
}

function messageFromPayload(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as { error: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }
  return fallback;
}

export async function apiFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit & { fallbackError?: string }
): Promise<T> {
  const res = await fetch(input, init);
  const payload = await parseResponseBody(res);
  if (!res.ok) {
    throw new ApiError(
      messageFromPayload(
        payload,
        init?.fallbackError ?? `Request failed with status ${res.status}`
      ),
      res.status,
      payload
    );
  }
  return payload as T;
}
