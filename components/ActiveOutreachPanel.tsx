"use client";
import { useState, useEffect, useMemo } from "react";
import { Lead } from "@/lib/schema";
import { apiFetch } from "@/lib/client/api";

interface Props {
  leads: Lead[];
}

interface CampaignAnalytics {
  campaignId: string;
  campaignName: string;
  emailsSent: number;
  contacted: number;
  opensUnique: number;
  openRate: number;
  repliesUnique: number;
  replyRate: number;
  bounced: number;
  bounceRate: number;
  unsubscribed: number;
  interested: number;
  meetingBooked: number;
}

const REENGAGEMENT_DAYS = 21;

function daysUntilReengagement(lead: Lead): string {
  if (!lead.initialOutreachDate) return "Missing outreach date";
  const started = new Date(lead.initialOutreachDate).getTime();
  if (!Number.isFinite(started)) return "Invalid outreach date";
  const elapsed = Math.floor((Date.now() - started) / (1000 * 60 * 60 * 24));
  const remaining = REENGAGEMENT_DAYS - elapsed;
  if (remaining <= 0) return "Eligible now";
  return `${remaining} day${remaining === 1 ? "" : "s"} left`;
}

// ─── Engagement badge ─────────────────────────────────────────────────────────

function EngagementBar({ lead }: { lead: Lead }) {
  if (lead.meetingBooked)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Meeting booked
      </span>
    );
  if (lead.replied)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        Replied · {lead.replySentiment || "unclassified"}
      </span>
    );
  if ((lead.emailsOpened || 0) > 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        {lead.emailsOpened} open{lead.emailsOpened !== 1 ? "s" : ""}
      </span>
    );
  if (lead.bounced)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Bounced
      </span>
    );
  if (lead.unsubscribed)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Unsubscribed
      </span>
    );
  return <span className="text-xs text-ink-300 font-mono">Awaiting contact</span>;
}

// ─── Rate bar visual ──────────────────────────────────────────────────────────

function RateBar({
  value,
  color,
  label,
}: {
  value: number;
  color: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-24 bg-ink-100 rounded-full h-1.5 flex-shrink-0">
        <div
          className={`h-1.5 rounded-full ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="font-mono text-ink-700 w-8 text-right">{value}%</span>
      <span className="text-ink-400">{label}</span>
    </div>
  );
}

// ─── Campaign performance card ────────────────────────────────────────────────

function CampaignCard({
  analytics,
  leadCount,
}: {
  analytics: CampaignAnalytics;
  leadCount: number;
}) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-900 leading-snug">
            {analytics.campaignName}
          </h3>
          <p className="text-xs text-ink-400 mt-0.5 font-mono">
            {leadCount} lead{leadCount !== 1 ? "s" : ""} ·{" "}
            {analytics.contacted} contacted · {analytics.emailsSent} emails sent
          </p>
        </div>
        {analytics.meetingBooked > 0 && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            {analytics.meetingBooked} meeting{analytics.meetingBooked !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <RateBar
          value={analytics.openRate}
          color="bg-amber-400"
          label="open rate"
        />
        <RateBar
          value={analytics.replyRate}
          color="bg-blue-400"
          label="reply rate"
        />
        <RateBar
          value={analytics.bounceRate}
          color="bg-red-400"
          label="bounce rate"
        />
      </div>

      <div className="flex gap-4 text-xs text-ink-500 pt-1 border-t border-ink-100">
        <span>
          <strong className="text-ink-800">{analytics.opensUnique}</strong> unique opens
        </span>
        <span>
          <strong className="text-ink-800">{analytics.repliesUnique}</strong> replies
        </span>
        <span>
          <strong className="text-ink-800">{analytics.bounced}</strong> bounced
        </span>
        {analytics.interested > 0 && (
          <span>
            <strong className="text-emerald-700">{analytics.interested}</strong> interested
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ActiveOutreachPanel({ leads }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [lastReengagement, setLastReengagement] = useState<string | null>(null);
  const [view, setView] = useState<"leads" | "campaigns">("leads");
  const [analytics, setAnalytics] = useState<CampaignAnalytics[] | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const wins = leads.filter((l) => l.meetingBooked || l.replied).length;
  const opens = leads.filter((l) => (l.emailsOpened || 0) > 0).length;
  const terminal = leads.filter((l) => l.bounced || l.unsubscribed).length;

  // Unique campaigns in this table
  const campaignIds = useMemo(() => {
    const ids = new Set<string>();
    leads.forEach((l) => {
      if (l.instantlyCampaignId) ids.add(l.instantlyCampaignId);
    });
    return Array.from(ids);
  }, [leads]);

  // Lead count per campaign
  const leadsPerCampaign = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l) => {
      if (l.instantlyCampaignId) {
        map[l.instantlyCampaignId] = (map[l.instantlyCampaignId] || 0) + 1;
      }
    });
    return map;
  }, [leads]);

  // Load analytics when switching to campaign view
  useEffect(() => {
    if (view !== "campaigns" || analytics !== null) return;
    setAnalyticsLoading(true);
    const ids = campaignIds.join(",");
    apiFetch<{ analytics?: CampaignAnalytics[] }>(
      `/api/campaigns/analytics${ids ? `?campaignIds=${ids}` : ""}`,
      { fallbackError: "Failed to fetch campaign analytics" }
    )
      .then((d) => setAnalytics(d.analytics || []))
      .catch(() => setAnalytics([]))
      .finally(() => setAnalyticsLoading(false));
  }, [view, analytics, campaignIds]);

  async function syncEngagement() {
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const data = await apiFetch<{ synced: number }>(
        "/api/engagement/refresh",
        { method: "POST", fallbackError: "Sync failed" }
      );
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setLastSync(now);
      setRefreshMsg({ kind: "ok", text: `Synced ${data.synced} leads · ${now}` });
    } catch (e) {
      setRefreshMsg({ kind: "err", text: e instanceof Error ? e.message : "Sync failed" });
    } finally {
      setRefreshing(false);
    }
  }

  async function triggerReengagement() {
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const data = await apiFetch<{ moved: number }>(
        "/api/reengagement/trigger",
        { method: "POST", fallbackError: "Trigger failed" }
      );
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setLastReengagement(now);
      setRefreshMsg({
        kind: "ok",
        text: `Re-engagement check complete · ${data.moved} lead${
          data.moved !== 1 ? "s" : ""
        } moved to archive · ${now}`,
      });
    } catch (e) {
      setRefreshMsg({ kind: "err", text: e instanceof Error ? e.message : "Trigger failed" });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4 border-l-4 border-l-violet-400">
          <div className="text-2xl font-semibold text-ink-900">{leads.length}</div>
          <div className="text-xs uppercase tracking-wide text-ink-500 mt-0.5">
            In campaign
          </div>
        </div>
        <div className="card p-4 border-l-4 border-l-amber-400">
          <div className="text-2xl font-semibold text-ink-900">{opens}</div>
          <div className="text-xs uppercase tracking-wide text-ink-500 mt-0.5">
            Opened
          </div>
        </div>
        <div className="card p-4 border-l-4 border-l-emerald-400">
          <div className="text-2xl font-semibold text-ink-900">{wins}</div>
          <div className="text-xs uppercase tracking-wide text-ink-500 mt-0.5">
            Replies / booked
          </div>
        </div>
        <div className="card p-4 border-l-4 border-l-red-300">
          <div className="text-2xl font-semibold text-ink-900">{terminal}</div>
          <div className="text-xs uppercase tracking-wide text-ink-500 mt-0.5">
            Terminal
          </div>
        </div>
      </div>

      {/* Actions + view toggle */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-col gap-0.5">
            <button
              onClick={syncEngagement}
              disabled={refreshing}
              className="btn-secondary"
            >
              {refreshing ? "Syncing…" : "↻ Sync engagement"}
            </button>
            <span className="text-xs text-ink-400 font-mono pl-1">
              Auto: weekdays 10 AM, 2 PM, 6 PM UTC
              {lastSync ? ` · last run ${lastSync}` : ""}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <button
              onClick={triggerReengagement}
              disabled={refreshing}
              className="btn-secondary"
            >
              {refreshing ? "Checking…" : "⟳ Run re-engagement check"}
            </button>
            <span className="text-xs text-ink-400 font-mono pl-1">
              Auto: nightly 5 AM UTC
              {lastReengagement ? ` · last run ${lastReengagement}` : ""}
            </span>
          </div>
        </div>
        {refreshMsg && (
          <div className={`text-xs font-mono px-3 py-2 rounded-md border ${
            refreshMsg.kind === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}>
            {refreshMsg.text}
          </div>
        )}
        <div className="flex justify-end">
          <div className="flex rounded-lg border border-ink-200 overflow-hidden">
            <button
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "leads"
                  ? "bg-ink-900 text-white"
                  : "bg-white text-ink-600 hover:bg-ink-50"
              }`}
              onClick={() => setView("leads")}
            >
              Lead view
            </button>
            <button
              className={`px-3 py-1.5 text-xs font-medium border-l border-ink-200 transition-colors ${
                view === "campaigns"
                  ? "bg-ink-900 text-white"
                  : "bg-white text-ink-600 hover:bg-ink-50"
              }`}
              onClick={() => setView("campaigns")}
            >
              Campaign performance
            </button>
          </div>
        </div>
      </div>

      {/* ── Lead view ── */}
      {view === "leads" && (
        <>
          {leads.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-ink-500 text-sm">
                No leads currently in campaign.
              </p>
              <p className="text-xs text-ink-400 mt-1">
                Approve and push leads from the Lead Queue tab to see them here.
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500 border-b border-ink-200">
                    <tr>
                      <th className="text-left font-semibold px-4 py-3">Lead</th>
                      <th className="text-left font-semibold px-4 py-3">Company</th>
                      <th className="text-left font-semibold px-4 py-3">Campaign</th>
                      <th className="text-left font-semibold px-4 py-3">Outreach</th>
                      <th className="text-left font-semibold px-4 py-3">Engagement</th>
                      <th className="text-left font-semibold px-4 py-3">Sync</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {leads.map((lead) => {
                      const fullName =
                        lead.name ||
                        [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
                        "(no name)";
                      return (
                        <tr
                          key={lead.id}
                          className="hover:bg-ink-50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-ink-900">{fullName}</div>
                            <div className="text-xs text-ink-400 mt-0.5">
                              {lead.title || "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-ink-800">
                              {lead.companyName || "—"}
                            </div>
                            <div className="text-xs text-ink-400">
                              {lead.industry || ""}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-ink-600">
                              {lead.instantlyCampaignName || "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-ink-600">
                              {lead.initialOutreachDate
                                ? new Date(lead.initialOutreachDate).toLocaleDateString()
                                : "—"}
                            </div>
                            <div className="text-xs text-ink-400 mt-0.5">
                              {daysUntilReengagement(lead)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <EngagementBar lead={lead} />
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            {lead.syncErrors ? (
                              <div
                                className="text-xs text-red-600 line-clamp-2"
                                title={lead.syncErrors}
                              >
                                {lead.syncErrors}
                              </div>
                            ) : (
                              <span className="text-xs text-ink-300">OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Campaign performance view ── */}
      {view === "campaigns" && (
        <>
          {analyticsLoading ? (
            <div className="card p-12 text-center">
              <p className="text-ink-500 text-sm">Loading campaign analytics from Instantly…</p>
            </div>
          ) : !analytics || analytics.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-ink-500 text-sm">No campaign analytics available.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analytics.map((a) => (
                <CampaignCard
                  key={a.campaignId}
                  analytics={a}
                  leadCount={leadsPerCampaign[a.campaignId] || 0}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
