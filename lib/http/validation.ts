import { NextRequest } from "next/server";
import { ValidationError } from "./errors";

export type JsonObject = Record<string, unknown>;

export async function parseJsonObject(req: NextRequest): Promise<JsonObject> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("Request body must be a JSON object");
  }
  return body as JsonObject;
}

export async function parseOptionalJsonObject(
  req: NextRequest
): Promise<JsonObject> {
  try {
    return await parseJsonObject(req);
  } catch (err) {
    if (
      err instanceof ValidationError &&
      err.message === "Request body must be valid JSON"
    ) {
      return {};
    }
    throw err;
  }
}

export function readOptionalString(
  obj: JsonObject,
  key: string
): string | undefined {
  const value = obj[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new ValidationError(`${key} must be a string`);
  }
  return value;
}

export function readString(
  obj: JsonObject,
  key: string,
  opts?: { allowEmpty?: boolean }
): string {
  const value = readOptionalString(obj, key);
  if (value === undefined) {
    throw new ValidationError(`${key} is required`);
  }
  if (!opts?.allowEmpty && !value.trim()) {
    throw new ValidationError(`${key} must be a non-empty string`);
  }
  return value;
}

export function readStringArray(
  obj: JsonObject,
  key: string,
  opts?: { minLength?: number; allowEmptyItems?: boolean }
): string[] {
  const raw = obj[key];
  if (!Array.isArray(raw)) {
    throw new ValidationError(`${key} must be an array`);
  }
  const values = raw.map((item, idx) => {
    if (typeof item !== "string") {
      throw new ValidationError(`${key}[${idx}] must be a string`);
    }
    if (!opts?.allowEmptyItems && !item.trim()) {
      throw new ValidationError(`${key}[${idx}] must be a non-empty string`);
    }
    return item;
  });
  const minLength = opts?.minLength ?? 0;
  if (values.length < minLength) {
    throw new ValidationError(
      `${key} must include at least ${minLength} item${
        minLength === 1 ? "" : "s"
      }`
    );
  }
  return values;
}
