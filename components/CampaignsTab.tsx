"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { sortCampaigns } from "@/lib/campaigns";
import type { CampaignRecord } from "@/lib/campaigns";
import { apiFetch } from "@/lib/client/api";
import { useCampaignRecords } from "./campaigns/useCampaignRecords";
import {
  FIXED_CAMPAIGN_BODY,
  FIXED_CAMPAIGN_SUBJECT,
} from "@/lib/fixed-campaign";

const STATUS_BADGE: Record<string, string> = {
  Draft: "bg-ink-100 text-ink-600 border-ink-200",
  Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Paused: "bg-amber-50 text-amber-700 border-amber-200",
  Completed: "bg-blue-50 text-blue-700 border-blue-200",
  "Running Subsequences": "bg-violet-50 text-violet-700 border-violet-200",
};

export function CampaignsTab() {
  const {
    campaigns,
    campaignsLoading: loading,
    campaignsError: error,
    refreshCampaigns,
  } = useCampaignRecords();
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const visibleCampaigns = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? campaigns.filter((campaign) =>
          [campaign.name, campaign.id, campaign.status]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(needle)
        )
      : campaigns;
    return sortCampaigns(filtered, "newest");
  }, [campaigns, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink-900">Campaign Builder</h2>
          <p className="mt-1 text-sm text-ink-500">
            Start from the Throttl sequence, then edit, add, delete, and reorder Instantly email steps.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={refreshCampaigns} className="btn-secondary text-sm">
            Refresh
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
            New campaign
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Starter first email</h3>
          <p className="mt-2 rounded-md border border-ink-200 bg-ink-50 px-3 py-2 font-mono text-sm text-ink-700">
            {FIXED_CAMPAIGN_SUBJECT}
          </p>
          <h3 className="mt-4 text-sm font-semibold text-ink-900">Allowed merge variables</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {["first_name", "company_name", "title", "industry"].map((field) => (
              <span key={field} className="badge bg-ink-50 text-ink-600 border-ink-200">
                {`{{${field}}}`}
              </span>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Starter body</h3>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-ink-200 bg-ink-50 p-3 font-mono text-xs leading-relaxed text-ink-700">
            {FIXED_CAMPAIGN_BODY}
          </pre>
        </div>
      </div>

      <div className="card p-4">
        <label className="label">Search campaigns</label>
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Instantly campaigns..."
        />
      </div>

      {loading ? (
        <div className="card p-8 text-center text-sm text-ink-500">
          Loading campaigns...
        </div>
      ) : error ? (
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong className="font-semibold">Error:</strong> {error}
        </div>
      ) : visibleCampaigns.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-500">
          No campaigns match the current search.
        </div>
      ) : (
        <div className="grid gap-2">
          {visibleCampaigns.map((campaign) => (
            <CampaignRow key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateCampaignModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            refreshCampaigns();
          }}
        />
      )}
    </div>
  );
}

function CampaignRow({ campaign }: { campaign: CampaignRecord }) {
  return (
    <div className="card-hover p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-medium text-ink-900">
              {campaign.name}
            </h3>
            <span
              className={`badge ${
                STATUS_BADGE[campaign.status] ??
                "bg-ink-50 text-ink-600 border-ink-200"
              }`}
            >
              {campaign.status}
            </span>
            {campaign.sendingStatusLabel && (
              <span className="badge bg-amber-50 text-amber-800 border-amber-200">
                {campaign.sendingStatusLabel}
              </span>
            )}
          </div>
          <p className="mt-1 break-all font-mono text-xs text-ink-400">
            {campaign.id}
          </p>
          <div className="mt-3 grid gap-2 text-xs text-ink-500 md:grid-cols-3">
            <Meta label="Created" value={formatDate(campaign.createdAt)} />
            <Meta label="Senders" value={`${campaign.emailCount} configured`} />
            <Meta
              label="Sent"
              value={
                campaign.analytics
                  ? `${campaign.analytics.emailsSent} emails`
                  : "No analytics"
              }
            />
          </div>
        </div>
        <div className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-500">
          <Link
            href={`/campaigns/editor?id=${campaign.id}`}
            className="btn-primary text-sm"
          >
            Edit sequence
          </Link>
          <div className="mt-2 rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-500">
            Activate sending settings in Instantly.
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateCampaignModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [campaignName, setCampaignName] = useState(
    `Throttl AI Toolkit - ${new Date().toLocaleDateString()}`
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!campaignName.trim()) {
      setError("Campaign name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignName: campaignName.trim() }),
        fallbackError: "Failed to create campaign",
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xl">
        <div className="border-b border-ink-200 px-6 py-4">
          <h3 className="text-base font-semibold text-ink-900">
            Create Instantly campaign
          </h3>
          <p className="mt-0.5 text-xs text-ink-500">
            The campaign will be created as a Draft with the Throttl starter sequence.
          </p>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label className="label">Campaign name</label>
            <input
              className="input"
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
            />
          </div>
          <div>
            <label className="label">Subject</label>
            <div className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2 font-mono text-sm text-ink-700">
              {FIXED_CAMPAIGN_SUBJECT}
            </div>
          </div>
          <div>
            <label className="label">Body</label>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-ink-200 bg-ink-50 p-3 font-mono text-xs leading-relaxed text-ink-700">
              {FIXED_CAMPAIGN_BODY}
            </pre>
          </div>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-between gap-3 border-t border-ink-200 bg-ink-50 px-6 py-3">
          <button onClick={onClose} className="btn-ghost text-sm" disabled={busy}>
            Cancel
          </button>
          <button onClick={save} className="btn-primary text-sm" disabled={busy}>
            {busy ? "Creating..." : "Create campaign"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-ink-400">
        {label}
      </p>
      <p className="mt-1 text-ink-700">{value}</p>
    </div>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}
