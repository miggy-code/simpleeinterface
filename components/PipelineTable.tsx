import Link from "next/link";
import { Lead, PIPELINE_STATUSES, TERMINAL_STATUSES } from "@/lib/schema";
import { StatusPill } from "./StatusPill";

function bucket(lead: Lead): "active" | "terminal" {
  if (!lead.pipelineStatus) return "active";
  return TERMINAL_STATUSES.includes(lead.pipelineStatus) ? "terminal" : "active";
}

function statusOrder(lead: Lead): number {
  const idx = PIPELINE_STATUSES.indexOf(
    (lead.pipelineStatus as (typeof PIPELINE_STATUSES)[number]) || "New"
  );
  return idx === -1 ? 99 : idx;
}

export function PipelineTable({ leads }: { leads: Lead[] }) {
  // Sort: active leads first, then terminal. Within each, by pipeline order, then by date desc.
  const sorted = [...leads].sort((a, b) => {
    const ba = bucket(a) === "active" ? 0 : 1;
    const bb = bucket(b) === "active" ? 0 : 1;
    if (ba !== bb) return ba - bb;
    const so = statusOrder(a) - statusOrder(b);
    if (so !== 0) return so;
    return (b.sourceDate || "").localeCompare(a.sourceDate || "");
  });

  if (!sorted.length) {
    return (
      <div className="card p-12 text-center">
        <h3 className="text-lg font-semibold mb-2">No leads yet</h3>
        <p className="text-sm text-ink-500">
          Source leads externally and they will appear here once they are added to Airtable.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="text-left font-semibold px-4 py-3">Lead</th>
              <th className="text-left font-semibold px-4 py-3">Company</th>
              <th className="text-left font-semibold px-4 py-3">Location</th>
              <th className="text-left font-semibold px-4 py-3">Status</th>
              <th className="text-left font-semibold px-4 py-3">Hook</th>
              <th className="text-left font-semibold px-4 py-3">Engagement</th>
              <th className="text-right font-semibold px-4 py-3">—</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {sorted.map((lead) => {
              const fullName =
                lead.name ||
                [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
                "(no name)";
              const eng = engagementBlurb(lead);
              return (
                <tr
                  key={lead.id}
                  className={`hover:bg-ink-50 transition-colors ${
                    bucket(lead) === "terminal" ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-900">{fullName}</div>
                    <div className="text-xs text-ink-400">
                      {lead.title || "—"}
                      {lead.email ? ` · ${lead.email}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {lead.companyName || "—"}
                    </div>
                    <div className="text-xs text-ink-400">
                      {lead.industry || ""}
                      {lead.revenueBand ? ` · ${lead.revenueBand}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {[lead.city, lead.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={lead.pipelineStatus} />
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {lead.personalizationHook ? (
                      <div
                        className="text-xs text-ink-600 line-clamp-2"
                        title={lead.personalizationHook}
                      >
                        {lead.personalizationHook}
                      </div>
                    ) : (
                      <span className="text-xs text-ink-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-500 font-mono">
                    {eng}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="btn-secondary"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function engagementBlurb(lead: Lead): string {
  if (lead.meetingBooked) return "📅 booked";
  if (lead.replied) return `✉ ${lead.replySentiment || "replied"}`;
  if ((lead.emailsOpened || 0) > 0) return `${lead.emailsOpened} opens`;
  if (lead.bounced) return "✗ bounced";
  if (lead.unsubscribed) return "✗ unsubscribed";
  return "—";
}
