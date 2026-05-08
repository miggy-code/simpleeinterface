import { Lead, PipelineStatus } from "@/lib/schema";

export function Stats({ leads }: { leads: Lead[] }) {
  const counts: Record<string, number> = {};
  for (const l of leads) {
    const s = l.pipelineStatus || "Unscored";
    counts[s] = (counts[s] || 0) + 1;
  }

  const buckets: { label: string; statuses: PipelineStatus[]; tone: string }[] = [
    {
      label: "Researching",
      statuses: ["Researching"],
      tone: "border-blue-200 bg-blue-50",
    },
    {
      label: "Ready / Personalized",
      statuses: ["Ready to Personalize", "Personalized"],
      tone: "border-cyan-200 bg-cyan-50",
    },
    {
      label: "Approved",
      statuses: ["Approved"],
      tone: "border-emerald-200 bg-emerald-50",
    },
    {
      label: "In Campaign",
      statuses: ["In Campaign", "Engaged"],
      tone: "border-violet-200 bg-violet-50",
    },
    {
      label: "Replied / Booked",
      statuses: ["Interested", "Meeting Booked"],
      tone: "border-emerald-300 bg-emerald-100",
    },
    {
      label: "Terminal",
      statuses: ["Bounced", "Unsubscribed", "Disqualified", "Not Interested"],
      tone: "border-ink-200 bg-ink-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {buckets.map((b) => {
        const total = b.statuses.reduce((acc, s) => acc + (counts[s] || 0), 0);
        return (
          <div
            key={b.label}
            className={`card border ${b.tone} p-4`}
          >
            <div className="text-3xl font-semibold tracking-tight text-ink-900">
              {total}
            </div>
            <div className="text-xs uppercase tracking-wide text-ink-500 mt-1">
              {b.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
