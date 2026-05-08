"use client";
import { useState } from "react";
import { Lead } from "@/lib/schema";
import { apiFetch } from "@/lib/client/api";

interface Props {
  leads: Lead[];
}

interface NurtureAngle {
  angle: string;
  hook: string;
  format: string;
}

// ─── Archive reason badge ─────────────────────────────────────────────────────

function ArchiveReasonBadge({ reason }: { reason?: string }) {
  if (!reason) return <span className="text-xs text-ink-300">—</span>;
  const tone = reason.startsWith("Terminal")
    ? "bg-red-50 text-red-700 border-red-200"
    : reason === "21-day sequence complete"
    ? "bg-ink-100 text-ink-600 border-ink-200"
    : "bg-blue-50 text-blue-700 border-blue-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs ${tone}`}>
      {reason}
    </span>
  );
}

// ─── Nurture angle card ───────────────────────────────────────────────────────

function NurtureAngleCard({ angle }: { angle: NurtureAngle }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(`${angle.angle}\n\n${angle.hook}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const formatColor: Record<string, string> = {
    "Blog post": "bg-violet-50 text-violet-700 border-violet-200",
    "Case study": "bg-blue-50 text-blue-700 border-blue-200",
    "Industry insight": "bg-cyan-50 text-cyan-700 border-cyan-200",
    Checklist: "bg-amber-50 text-amber-700 border-amber-200",
    "Short video": "bg-pink-50 text-pink-700 border-pink-200",
  };

  return (
    <div className="bg-ink-50 rounded-lg border border-ink-200 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink-900 leading-snug">{angle.angle}</p>
        <button
          onClick={copy}
          className="flex-shrink-0 text-xs text-ink-400 hover:text-ink-700 transition-colors font-mono"
          title="Copy to clipboard"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="text-xs text-ink-500 leading-relaxed">{angle.hook}</p>
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs ${
          formatColor[angle.format] || "bg-ink-100 text-ink-600 border-ink-200"
        }`}
      >
        {angle.format}
      </span>
    </div>
  );
}

// ─── Expandable lead row ──────────────────────────────────────────────────────

function ArchiveLeadRow({ lead }: { lead: Lead }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [angles, setAngles] = useState<NurtureAngle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fullName =
    lead.name ||
    [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
    "(no name)";

  const generateAngles = async () => {
    if (angles) return; // already loaded
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ angles?: NurtureAngle[] }>(
        `/api/leads/${lead.id}/nurture-angles`,
        {
        method: "POST",
          fallbackError: "Generation failed",
        }
      );
      setAngles(data.angles || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate angles");
    } finally {
      setLoading(false);
    }
  };

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !angles && !loading) {
      generateAngles();
    }
  };

  return (
    <>
      <tr
        className={`transition-colors cursor-pointer ${
          expanded ? "bg-ink-50" : "hover:bg-ink-50/50 opacity-80"
        }`}
        onClick={handleExpand}
      >
        <td className="px-4 py-3 w-8">
          <svg
            className={`w-3.5 h-3.5 text-ink-400 transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </td>
        <td className="px-4 py-3">
          <div className="font-medium text-ink-800">{fullName}</div>
          <div className="text-xs text-ink-400 mt-0.5">
            {lead.title || "—"}
            {lead.email ? ` · ${lead.email}` : ""}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="font-medium text-ink-700">{lead.companyName || "—"}</div>
          <div className="text-xs text-ink-400">
            {lead.industry || ""}
            {lead.revenueBand ? ` · ${lead.revenueBand}` : ""}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="text-xs text-ink-500">{lead.instantlyCampaignName || "—"}</div>
        </td>
        <td className="px-4 py-3">
          <ArchiveReasonBadge reason={lead.archiveReason} />
        </td>
        <td className="px-4 py-3">
          {lead.meetingBooked ? (
            <span className="text-xs text-emerald-700 font-medium">Meeting booked</span>
          ) : lead.replied ? (
            <span className="text-xs text-blue-700">
              Replied · {lead.replySentiment || "unclassified"}
            </span>
          ) : lead.bounced ? (
            <span className="text-xs text-red-600">Bounced</span>
          ) : lead.unsubscribed ? (
            <span className="text-xs text-red-600">Unsubscribed</span>
          ) : (
            <span className="text-xs text-ink-400">No response</span>
          )}
        </td>
      </tr>

      {/* Expanded nurture panel */}
      {expanded && (
        <tr className="bg-ink-50/80">
          <td colSpan={6} className="px-6 py-5">
            <div className="space-y-4">
              {/* Research insights if available */}
              {lead.personalizationInsights && (
                <div className="bg-white rounded-lg border border-ink-200 p-4">
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                    Research insights
                  </p>
                  <p className="text-xs text-ink-600 leading-relaxed whitespace-pre-line">
                    {lead.personalizationInsights}
                  </p>
                </div>
              )}

              {/* Nurture angles */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">
                    AI-suggested re-engagement angles
                  </p>
                  {angles && (
                    <button
                      className="text-xs text-ink-400 hover:text-ink-700 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAngles(null);
                        generateAngles();
                      }}
                    >
                      Regenerate
                    </button>
                  )}
                </div>

                {loading && (
                  <div className="flex items-center gap-2 text-xs text-ink-400 py-3">
                    <svg
                      className="w-3.5 h-3.5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    Generating nurture angles…
                  </div>
                )}

                {error && (
                  <div className="text-xs text-red-600 py-2">{error}</div>
                )}

                {angles && angles.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {angles.map((a, i) => (
                      <NurtureAngleCard key={i} angle={a} />
                    ))}
                  </div>
                )}

                {angles && angles.length === 0 && (
                  <p className="text-xs text-ink-400">
                    No angles generated. Try again.
                  </p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ArchivePanel({ leads }: Props) {
  const total = leads.length;
  const replied = leads.filter((l) => l.replied).length;
  const booked = leads.filter((l) => l.meetingBooked).length;
  const terminal = leads.filter((l) => l.bounced || l.unsubscribed).length;
  const eligible = leads.filter(
    (l) => l.archiveReason === "21-day sequence complete" && !l.bounced && !l.unsubscribed
  ).length;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4 border-l-4 border-l-ink-300">
          <div className="text-2xl font-semibold text-ink-900">{total}</div>
          <div className="text-xs uppercase tracking-wide text-ink-500 mt-0.5">
            Total archived
          </div>
        </div>
        <div className="card p-4 border-l-4 border-l-emerald-400">
          <div className="text-2xl font-semibold text-ink-900">{booked}</div>
          <div className="text-xs uppercase tracking-wide text-ink-500 mt-0.5">
            Meetings booked
          </div>
        </div>
        <div className="card p-4 border-l-4 border-l-blue-400">
          <div className="text-2xl font-semibold text-ink-900">{replied}</div>
          <div className="text-xs uppercase tracking-wide text-ink-500 mt-0.5">
            Replied
          </div>
        </div>
        <div className="card p-4 border-l-4 border-l-violet-400">
          <div className="text-2xl font-semibold text-ink-900">{eligible}</div>
          <div className="text-xs uppercase tracking-wide text-ink-500 mt-0.5">
            Re-engagement eligible
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="card p-4 bg-blue-50 border-blue-200 text-sm text-blue-800">
        <strong>Re-engagement repository.</strong> These leads have completed
        the initial outreach sequence. Click any row to generate AI-suggested
        re-engagement content angles based on their research profile. Use these
        to inform your nurture campaign content in Instantly.
      </div>

      {leads.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-ink-500 text-sm">No leads in the archive yet.</p>
          <p className="text-xs text-ink-400 mt-1">
            Leads move here automatically 21 days after initial outreach, or
            when they reach a terminal status.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500 border-b border-ink-200">
                <tr>
                  <th className="px-4 py-3 w-8" />
                  <th className="text-left font-semibold px-4 py-3">Lead</th>
                  <th className="text-left font-semibold px-4 py-3">Company</th>
                  <th className="text-left font-semibold px-4 py-3">Campaign</th>
                  <th className="text-left font-semibold px-4 py-3">Archive reason</th>
                  <th className="text-left font-semibold px-4 py-3">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {leads.map((lead) => (
                  <ArchiveLeadRow key={lead.id} lead={lead} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
