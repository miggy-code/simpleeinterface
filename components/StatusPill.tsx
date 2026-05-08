import { STATUS_TONE } from "@/lib/schema";

/**
 * Tiny status badge used in tables. Accepts any string (Airtable returns
 * strings, not enums); falls back to a neutral tone when the status is
 * unknown.
 */
export function StatusPill({ status }: { status?: string }) {
  if (!status) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border bg-ink-50 text-ink-500 border-ink-200">
        —
      </span>
    );
  }
  const tone =
    STATUS_TONE[status] ?? "bg-ink-50 text-ink-500 border-ink-200";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border ${tone}`}
    >
      {status}
    </span>
  );
}
