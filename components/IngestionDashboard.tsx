"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { Lead } from "@/lib/schema";
import { StatusPill } from "./StatusPill";
import { useCampaignRecords } from "./campaigns/useCampaignRecords";
import { apiFetch } from "@/lib/client/api";

interface Props {
  leads: Lead[];
}

interface Verification {
  email: string;
  decision: "safe" | "blocked" | "missing_email" | "error";
  result?: string;
  reason?: string;
  error?: string;
}

interface PushResult {
  id: string;
  name?: string;
  status: "success" | "skipped" | "error";
  reason?: string;
  verification?: Verification;
  lead?: Lead;
}

interface RoleRevisionResult {
  id: string;
  previousTitle: string;
  revisedTitle: string;
  changed: boolean;
  lead: Lead;
}

type EditableField =
  | "firstName"
  | "email"
  | "companyName"
  | "title"
  | "industry"
  | "companyDomain"
  | "instantlyCampaignId";

type Readiness = "missing" | "ready" | "safe" | "blocked" | "pushed";
type StatusFilter = Readiness | "all";

const REQUIRED_FIELDS: Array<{ key: keyof Lead; label: string }> = [
  { key: "firstName", label: "first name" },
  { key: "email", label: "email" },
  { key: "companyName", label: "company" },
  { key: "title", label: "title" },
  { key: "industry", label: "industry" },
];

function fullName(lead: Lead): string {
  return (
    lead.name ||
    [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
    "(no name)"
  );
}

function missingFields(lead: Lead): string[] {
  const missing = REQUIRED_FIELDS.filter(({ key }) => {
    const value = lead[key];
    return typeof value !== "string" || value.trim() === "";
  }).map(({ label }) => label);
  if (!lead.instantlyCampaignId?.trim()) missing.push("campaign");
  return missing;
}

function getReadiness(lead: Lead, verification?: Verification): Readiness {
  if (lead.pipelineStatus === "In Campaign" || lead.instantlyLeadId) return "pushed";
  if (verification && verification.decision !== "safe") return "blocked";
  if (missingFields(lead).length > 0) return "missing";
  if (verification?.decision === "safe") return "safe";
  return "ready";
}

function readinessLabel(readiness: Readiness): string {
  switch (readiness) {
    case "missing":
      return "Missing fields";
    case "ready":
      return "Ready to debounce";
    case "safe":
      return "Safe";
    case "blocked":
      return "Blocked";
    case "pushed":
      return "Pushed";
  }
}

function readinessClass(readiness: Readiness): string {
  switch (readiness) {
    case "missing":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "ready":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "safe":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "blocked":
      return "bg-red-50 text-red-700 border-red-200";
    case "pushed":
      return "bg-ink-100 text-ink-600 border-ink-200";
  }
}

function verificationLabel(verification?: Verification): string {
  if (!verification) return "Not checked";
  if (verification.decision === "safe") return "Safe to send";
  return verification.error || verification.result || "Needs review";
}

function editablePayload(lead: Lead): Partial<Lead> {
  return {
    firstName: lead.firstName ?? "",
    email: lead.email ?? "",
    companyName: lead.companyName ?? "",
    title: lead.title ?? "",
    industry: lead.industry ?? "",
    companyDomain: lead.companyDomain ?? "",
    instantlyCampaignId: lead.instantlyCampaignId ?? "",
  };
}

export function IngestionDashboard({ leads: initialLeads }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [drafts, setDrafts] = useState<Record<string, Lead>>(() =>
    Object.fromEntries(initialLeads.map((lead) => [lead.id, lead]))
  );
  const [editingDomainIds, setEditingDomainIds] = useState<Set<string>>(new Set());
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCampaignId, setBulkCampaignId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [verifications, setVerifications] = useState<Record<string, Verification>>({});
  const [pushResults, setPushResults] = useState<PushResult[] | null>(null);
  const [unsafePushOpen, setUnsafePushOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );
  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  const {
    campaigns,
    campaignsLoading,
    campaignsError,
    refreshCampaigns,
  } = useCampaignRecords();

  const selectedCampaign = campaigns.find((campaign) => campaign.id === bulkCampaignId);
  const leadCampaignNames = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign.name])),
    [campaigns]
  );

  const visibleLeads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads
      .map((lead) => drafts[lead.id] ?? lead)
      .filter((lead) => {
        const readiness = getReadiness(lead, verifications[lead.id]);
        if (statusFilter !== "all" && readiness !== statusFilter) return false;
        if (needle) {
          const text = [
            fullName(lead),
            lead.email,
            lead.companyName,
            lead.title,
            lead.industry,
            lead.companyDomain,
            lead.instantlyCampaignName,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!text.includes(needle)) return false;
        }
        return true;
      });
  }, [drafts, leads, query, statusFilter, verifications]);

  const selectedLeads = useMemo(
    () => visibleLeads.filter((lead) => selectedIds.has(lead.id)),
    [selectedIds, visibleLeads]
  );
  const bulkActionLeads = selectedLeads.length ? selectedLeads : visibleLeads;
  const bulkActionScope = selectedLeads.length ? "selected rows" : "filtered view";
  const selectedActionLabel =
    selectedLeads.length > 0
      ? `selected ${selectedLeads.length} lead${selectedLeads.length === 1 ? "" : "s"}`
      : "selected leads";
  const dirtyActionLeads = bulkActionLeads.filter((lead) => dirtyIds.has(lead.id));
  const allVisibleSelected =
    visibleLeads.length > 0 && visibleLeads.every((lead) => selectedIds.has(lead.id));

  const counts = useMemo(() => {
    const next: Record<Readiness, number> = {
      missing: 0,
      ready: 0,
      safe: 0,
      blocked: 0,
      pushed: 0,
    };
    for (const lead of leads) {
      const draft = drafts[lead.id] ?? lead;
      next[getReadiness(draft, verifications[lead.id])] += 1;
    }
    return next;
  }, [drafts, leads, verifications]);

  function scrollToDebounceColumns() {
    const container = tableScrollRef.current;
    if (!container) return;
    container.scrollTo({
      left: container.scrollWidth,
      behavior: "smooth",
    });
  }

  function updateDraft(id: string, field: EditableField, value: string) {
    setDrafts((prev) => {
      const current = prev[id] ?? leads.find((lead) => lead.id === id);
      if (!current) return prev;
      const nextLead: Lead = { ...current, [field]: value };
      if (field === "instantlyCampaignId") {
        nextLead.instantlyCampaignName = leadCampaignNames.get(value) ?? "";
      }
      return { ...prev, [id]: nextLead };
    });
    setDirtyIds((prev) => new Set(prev).add(id));
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(visibleLeads.map((lead) => lead.id)));
  }

  async function saveLeads(targets = dirtyActionLeads) {
    if (targets.length === 0) return;
    setBusy("save");
    setMessage(null);
    try {
      const updates = await Promise.all(
        targets.map((lead) =>
          apiFetch<{ lead: Lead }>(`/api/leads/${lead.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(editablePayload(lead)),
            fallbackError: "Failed to save lead edits",
          })
        )
      );
      const byId = new Map(updates.map((item) => [item.lead.id, item.lead]));
      setLeads((prev) => prev.map((lead) => byId.get(lead.id) ?? lead));
      setDrafts((prev) => ({ ...prev, ...Object.fromEntries(updates.map((u) => [u.lead.id, u.lead])) }));
      setDirtyIds((prev) => {
        const next = new Set(prev);
        for (const update of updates) next.delete(update.lead.id);
        return next;
      });
      setMessage({
        kind: "ok",
        text: `Saved ${updates.length} lead${updates.length === 1 ? "" : "s"}.`,
      });
      setEditingDomainIds((prev) => {
        const next = new Set(prev);
        for (const update of updates) next.delete(update.lead.id);
        return next;
      });
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Saving lead edits failed",
      });
    } finally {
      setBusy(null);
    }
  }

  async function assignCampaign() {
    if (!selectedCampaign) {
      setMessage({ kind: "err", text: "Choose a campaign before assigning leads." });
      return;
    }
    if (selectedLeads.length === 0) {
      setMessage({ kind: "err", text: "Select one or more rows before assigning a campaign." });
      return;
    }
    setBusy("assign");
    setMessage(null);
    try {
      const updates = await Promise.all(
        selectedLeads.map((lead) =>
          apiFetch<{ lead: Lead }>(`/api/leads/${lead.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ instantlyCampaignId: selectedCampaign.id }),
            fallbackError: "Failed to assign campaign",
          })
        )
      );
      const byId = new Map(updates.map((item) => [item.lead.id, item.lead]));
      setLeads((prev) => prev.map((lead) => byId.get(lead.id) ?? lead));
      setDrafts((prev) => ({ ...prev, ...Object.fromEntries(updates.map((u) => [u.lead.id, u.lead])) }));
      setDirtyIds((prev) => {
        const next = new Set(prev);
        for (const update of updates) next.delete(update.lead.id);
        return next;
      });
      setMessage({
        kind: "ok",
        text: `Assigned ${updates.length} lead${updates.length === 1 ? "" : "s"} to ${selectedCampaign.name}.`,
      });
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Campaign assignment failed",
      });
    } finally {
      setBusy(null);
    }
  }

  async function verifyLeads() {
    if (bulkActionLeads.length === 0) return;
    if (dirtyActionLeads.length > 0) {
      setMessage({ kind: "err", text: "Save edited rows before running DeBounce." });
      return;
    }
    setBusy("verify");
    setMessage(null);
    try {
      const data = await apiFetch<{
        results: Array<{ id: string; verification: Verification }>;
      }>("/api/leads/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: bulkActionLeads.map((lead) => lead.id) }),
        fallbackError: "DeBounce verification failed",
      });
      setVerifications((prev) => {
        const next = { ...prev };
        for (const result of data.results) next[result.id] = result.verification;
        return next;
      });
      const safe = data.results.filter((result) => result.verification.decision === "safe").length;
      setMessage({
        kind: safe === data.results.length ? "ok" : "err",
        text: `${safe} of ${data.results.length} lead${data.results.length === 1 ? "" : "s"} returned Safe to Send.`,
      });
      scrollToDebounceColumns();
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "DeBounce verification failed",
      });
    } finally {
      setBusy(null);
    }
  }

  async function reviseRoles() {
    if (bulkActionLeads.length === 0) return;
    if (dirtyActionLeads.length > 0) {
      setMessage({ kind: "err", text: "Save edited rows before revising roles." });
      return;
    }
    setBusy("revise-roles");
    setMessage(null);
    try {
      const data = await apiFetch<{
        results: RoleRevisionResult[];
        summary: { total: number; revisedCount: number; unchangedCount: number };
      }>("/api/leads/revise-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: bulkActionLeads.map((lead) => lead.id) }),
        fallbackError: "Failed to revise roles",
      });
      const updatedLeads = data.results.map((result) => result.lead);
      const byId = new Map(updatedLeads.map((lead) => [lead.id, lead]));
      setLeads((prev) => prev.map((lead) => byId.get(lead.id) ?? lead));
      setDrafts((prev) => ({
        ...prev,
        ...Object.fromEntries(updatedLeads.map((lead) => [lead.id, lead])),
      }));
      setMessage({
        kind: "ok",
        text:
          data.summary.revisedCount > 0
            ? `Revised ${data.summary.revisedCount} of ${data.summary.total} title${
                data.summary.total === 1 ? "" : "s"
              }.`
            : `No titles needed revision across ${data.summary.total} lead${
                data.summary.total === 1 ? "" : "s"
              }.`,
      });
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Failed to revise roles",
      });
    } finally {
      setBusy(null);
    }
  }

  async function pushLeads(forceUnsafe = false) {
    if (bulkActionLeads.length === 0) return;
    if (dirtyActionLeads.length > 0) {
      setMessage({ kind: "err", text: "Save edited rows before pushing leads." });
      return;
    }
    setBusy("push");
    setMessage(null);
    setPushResults(null);
    try {
      const data = await apiFetch<{ results: PushResult[] }>(
        "/api/leads/bulk-push",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              leadIds: bulkActionLeads.map((lead) => lead.id),
              forceUnsafe,
            }),
            fallbackError: "Failed to push leads to Instantly",
          }
        );
      setPushResults(data.results);
      setVerifications((prev) => {
        const next = { ...prev };
        for (const result of data.results) {
          if (result.verification) next[result.id] = result.verification;
        }
        return next;
      });
      const updated = data.results
        .filter((result) => result.status === "success" && result.lead)
        .map((result) => result.lead as Lead);
      const byId = new Map(updated.map((lead) => [lead.id, lead]));
      setLeads((prev) => prev.map((lead) => byId.get(lead.id) ?? lead));
      setDrafts((prev) => ({ ...prev, ...Object.fromEntries(updated.map((lead) => [lead.id, lead])) }));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const lead of updated) next.delete(lead.id);
        return next;
      });
      setMessage({
        kind: updated.length === data.results.length ? "ok" : "err",
        text: `${updated.length} of ${data.results.length} lead${data.results.length === 1 ? "" : "s"} pushed to Instantly.`,
      });
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Push failed",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm shadow-[0_18px_50px_-36px_rgba(14,14,8,0.55)] ${
            message.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {message.text}
        </div>
      )}
      {campaignsError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-[0_18px_50px_-36px_rgba(127,29,29,0.45)]">
          {campaignsError}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label="Missing Fields"
          value={counts.missing}
          tone="amber"
          helper="Needs cleanup before campaign work"
        />
        <SummaryCard
          label="Ready to Debounce"
          value={counts.ready}
          tone="sky"
          helper="Ready for validation"
        />
        <SummaryCard
          label="Safe"
          value={counts.safe}
          tone="emerald"
          helper="Cleared for outreach"
        />
        <SummaryCard
          label="Blocked"
          value={counts.blocked}
          tone="rose"
          helper="Requires manual review"
        />
        <SummaryCard
          label="Pushed"
          value={counts.pushed}
          tone="ink"
          helper="Already inside campaign"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-ink-100/80 bg-[linear-gradient(135deg,rgba(250,244,236,0.85),rgba(255,255,255,0.85))] px-5 py-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
                Lead workspace
              </p>
              <h2 className="mt-1 text-xl font-semibold text-ink-900">
                Review, clean, and route leads
              </h2>
            </div>
            <div className="text-xs text-ink-400">
              {visibleLeads.length} visible of {leads.length} total
            </div>
          </div>
        </div>
        <div className="grid gap-3 p-5 lg:grid-cols-[minmax(0,1fr)_220px_320px]">
          <div className="min-w-0">
            <label className="label">Search</label>
            <input
              className="input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, email, company, title, industry, domain..."
            />
          </div>
          <div className="min-w-0">
            <label className="label">Readiness</label>
            <select
              className="input"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="all">All leads</option>
              <option value="missing">Missing fields</option>
              <option value="ready">Ready to debounce</option>
              <option value="safe">Safe</option>
              <option value="blocked">Blocked</option>
              <option value="pushed">Pushed</option>
            </select>
          </div>
          <div className="min-w-0">
            <label className="label">Bulk campaign assignment</label>
            <div className="flex gap-2">
              <select
                className="input"
                value={bulkCampaignId}
                onChange={(event) => setBulkCampaignId(event.target.value)}
                disabled={campaignsLoading}
              >
                <option value="">Choose campaign...</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={refreshCampaigns}
                className="btn-secondary text-sm"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 flex-1">
              <label className="label">Bulk campaign assignment</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  className="input sm:max-w-[360px]"
                  value={bulkCampaignId}
                  onChange={(event) => setBulkCampaignId(event.target.value)}
                  disabled={campaignsLoading}
                >
                  <option value="">Choose campaign...</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={assignCampaign}
                  disabled={busy !== null || !selectedCampaign || selectedLeads.length === 0}
                  className="btn-primary text-sm whitespace-nowrap"
                >
                  {busy === "assign"
                    ? "Assigning..."
                    : `Assign ${selectedActionLabel}`}
                </button>
              </div>
              <p className="mt-2 text-xs text-ink-400">
                Select rows first. The assignment is saved back to Airtable.
              </p>
            </div>

            {selectedIds.size > 0 && (
              <div className="rounded-2xl border border-ink-100 bg-ink-50 px-3 py-2 text-xs font-medium text-ink-700 shadow-[0_18px_45px_-34px_rgba(14,14,8,0.45)]">
                {selectedIds.size} selected
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="ml-3 text-ink-500 hover:text-ink-900"
                >
                  Clear selection
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <button
              onClick={() => saveLeads()}
              disabled={busy !== null || dirtyActionLeads.length === 0}
              className="flex min-h-[78px] flex-col items-start justify-center gap-1 rounded-2xl border border-white/70 bg-white/85 px-4 py-3 text-left shadow-[0_18px_45px_-34px_rgba(14,14,8,0.35)] transition-all hover:-translate-y-px hover:border-ink-200 hover:bg-white disabled:opacity-50"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
                Writeback
              </span>
              {busy === "save"
                ? "Saving..."
                : `Save edits (${dirtyActionLeads.length})`}
              <span className="text-xs text-ink-400">
                Persist manual field changes to Airtable.
              </span>
            </button>
            <button
              onClick={reviseRoles}
              disabled={busy !== null || bulkActionLeads.length === 0}
              className="flex min-h-[78px] flex-col items-start justify-center gap-1 rounded-2xl border border-white/70 bg-white/85 px-4 py-3 text-left shadow-[0_18px_45px_-34px_rgba(14,14,8,0.35)] transition-all hover:-translate-y-px hover:border-ink-200 hover:bg-white disabled:opacity-50"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
                Cleanup
              </span>
              {busy === "revise-roles"
                ? "Revising..."
                : `Revise roles (${bulkActionLeads.length})`}
              <span className="text-xs text-ink-400">
                Normalize job titles before review and push.
              </span>
            </button>
            <button
              onClick={verifyLeads}
              disabled={busy !== null || bulkActionLeads.length === 0}
              className="flex min-h-[78px] flex-col items-start justify-center gap-1 rounded-2xl border border-white/70 bg-white/85 px-4 py-3 text-left shadow-[0_18px_45px_-34px_rgba(14,14,8,0.35)] transition-all hover:-translate-y-px hover:border-ink-200 hover:bg-white disabled:opacity-50"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
                Validation
              </span>
              {busy === "verify"
                ? "Verifying..."
                : `Run DeBounce (${bulkActionLeads.length})`}
              <span className="text-xs text-ink-400">
                Check deliverability before any send.
              </span>
            </button>
            <button
              onClick={() => pushLeads(false)}
              disabled={busy !== null || bulkActionLeads.length === 0}
              className="flex min-h-[78px] flex-col items-start justify-center gap-1 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left shadow-[0_18px_45px_-34px_rgba(180,83,9,0.18)] transition-all hover:-translate-y-px hover:border-amber-300 hover:bg-amber-100 disabled:opacity-50"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                Safe push
              </span>
              {busy === "push"
                ? "Pushing..."
                : `Push safe leads (${bulkActionLeads.length})`}
              <span className="text-xs text-amber-700/80">
                Only leads cleared by DeBounce.
              </span>
            </button>
            <button
              onClick={() => setUnsafePushOpen(true)}
              disabled={busy !== null || bulkActionLeads.length === 0}
              className="flex min-h-[78px] flex-col items-start justify-center gap-1 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left shadow-[0_18px_45px_-34px_rgba(127,29,29,0.16)] transition-all hover:-translate-y-px hover:border-red-300 hover:bg-red-100 disabled:opacity-50"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-red-700">
                Override
              </span>
              Push unsafe leads
              <span className="text-xs text-red-700/80">
                Bypass DeBounce after confirmation.
              </span>
            </button>
          </div>
        </div>
      </div>

      {unsafePushOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 px-4 backdrop-blur-sm"
          onClick={() => setUnsafePushOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-[1.75rem] border border-amber-200 bg-white p-6 shadow-[0_30px_90px_-36px_rgba(14,14,8,0.55)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-red-700">
                Warning
              </div>
            </div>
            <h3 className="mt-4 text-xl font-semibold text-ink-900">
              Push unsafe leads?
            </h3>
            <p className="mt-3 text-sm leading-6 text-ink-600">
              This will send {bulkActionLeads.length} lead{bulkActionLeads.length === 1 ? "" : "s"} even if DeBounce has not cleared them.
              Use this only if you intentionally want to override the safety check.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setUnsafePushOpen(false)}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setUnsafePushOpen(false);
                  void pushLeads(true);
                }}
                className="btn-primary border-red-700 bg-red-700 text-sm hover:bg-red-800"
              >
                Push unsafe leads
              </button>
            </div>
          </div>
        </div>
      )}

      {pushResults && (
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink-900">Last push results</h3>
          <div className="space-y-1.5">
            {pushResults.map((result) => (
              <div
                key={result.id}
                className={`rounded-md px-3 py-2 text-xs ${
                  result.status === "success"
                    ? "bg-emerald-50 text-emerald-800"
                    : result.status === "skipped"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-red-50 text-red-700"
                }`}
              >
                <span className="font-semibold capitalize">{result.status}</span>{" "}
                {result.name || result.id}
                {result.reason && <span className="ml-2 text-ink-500">{result.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {visibleLeads.length === 0 ? (
        <div className="card p-12 text-center text-sm text-ink-400">
          No leads match the current filters.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100/80 px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-ink-900">Lead table</h3>
              <p className="mt-1 text-xs text-ink-400">
                Core sequence fields stay inline. Lower-priority data such as company domain is edited on demand.
              </p>
            </div>
          </div>
          <div ref={tableScrollRef} className="overflow-x-auto">
            <table className="min-w-[1320px] w-full text-sm">
              <thead>
                <tr className="bg-[linear-gradient(180deg,rgba(247,247,246,0.95),rgba(247,247,246,0.72))] text-xs uppercase tracking-[0.18em] text-ink-500">
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-ink-300 text-ink-900 focus:ring-ink-400"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-3 py-3 text-left font-semibold">First Name</th>
                  <th className="px-3 py-3 text-left font-semibold">Email</th>
                  <th className="px-3 py-3 text-left font-semibold">Company</th>
                  <th className="px-3 py-3 text-left font-semibold">Title</th>
                  <th className="px-3 py-3 text-left font-semibold">Industry</th>
                  <th className="px-3 py-3 text-left font-semibold">Company URL/Domain</th>
                  <th className="px-3 py-3 text-left font-semibold">Campaign</th>
                  <th className="px-3 py-3 text-left font-semibold">Readiness</th>
                  <th className="px-3 py-3 text-left font-semibold">DeBounce</th>
                  <th className="px-3 py-3 text-left font-semibold">Status</th>
                  <th className="px-3 py-3 text-right font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {visibleLeads.map((lead) => {
                  const selected = selectedIds.has(lead.id);
                  const verification = verifications[lead.id];
                  const readiness = getReadiness(lead, verification);
                  const missing = missingFields(lead);
                  const isDirty = dirtyIds.has(lead.id);

                  return (
                    <tr
                      key={lead.id}
                      className={`border-t border-ink-100/80 transition-colors ${
                        selected ? "bg-[rgba(193,96,43,0.08)]" : "hover:bg-white/60"
                      }`}
                    >
                      <td className="px-3 py-3 align-top">
                        <input
                          type="checkbox"
                          className="rounded border-ink-300 text-ink-900 focus:ring-ink-400"
                          checked={selected}
                          onChange={() => toggleSelect(lead.id)}
                        />
                      </td>
                      <EditableCell
                        value={lead.firstName ?? ""}
                        onChange={(value) => updateDraft(lead.id, "firstName", value)}
                      />
                      <EditableCell
                        value={lead.email ?? ""}
                        onChange={(value) => updateDraft(lead.id, "email", value)}
                        type="email"
                      />
                      <EditableCell
                        value={lead.companyName ?? ""}
                        onChange={(value) => updateDraft(lead.id, "companyName", value)}
                      />
                      <EditableCell
                        value={lead.title ?? ""}
                        onChange={(value) => updateDraft(lead.id, "title", value)}
                      />
                      <EditableCell
                        value={lead.industry ?? ""}
                        onChange={(value) => updateDraft(lead.id, "industry", value)}
                      />
                      <DomainCell
                        value={lead.companyDomain ?? ""}
                        isEditing={editingDomainIds.has(lead.id)}
                        onEditToggle={() =>
                          setEditingDomainIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(lead.id)) next.delete(lead.id);
                            else next.add(lead.id);
                            return next;
                          })
                        }
                        onChange={(value) => updateDraft(lead.id, "companyDomain", value)}
                      />
                      <td className="px-3 py-3 align-top">
                        <select
                          className="input h-9 min-w-48 text-xs"
                          value={lead.instantlyCampaignId ?? ""}
                          onChange={(event) =>
                            updateDraft(lead.id, "instantlyCampaignId", event.target.value)
                          }
                          disabled={campaignsLoading}
                        >
                          <option value="">Not assigned</option>
                          {campaigns.map((campaign) => (
                            <option key={campaign.id} value={campaign.id}>
                              {campaign.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={`inline-flex rounded-md border px-2 py-0.5 text-xs ${readinessClass(
                            readiness
                          )}`}
                          title={missing.length ? `Missing: ${missing.join(", ")}` : undefined}
                        >
                          {readinessLabel(readiness)}
                        </span>
                        {missing.length > 0 && (
                          <div className="mt-1 max-w-44 text-[11px] text-red-600">
                            Missing: {missing.join(", ")}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="text-xs text-ink-600">
                          {verificationLabel(verification)}
                        </div>
                        {verification?.reason && (
                          <div className="mt-0.5 max-w-36 text-[11px] text-ink-400">
                            {verification.reason}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <StatusPill status={lead.pipelineStatus} />
                      </td>
                      <td className="px-3 py-3 text-right align-top">
                        <div className="flex justify-end gap-2">
                          {isDirty && (
                            <button
                              type="button"
                              onClick={() => saveLeads([lead])}
                              disabled={busy !== null}
                              className="btn-primary text-xs"
                            >
                              Save
                            </button>
                          )}
                          <Link href={`/leads/${lead.id}`} className="btn-secondary text-xs">
                            Detail
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function EditableCell({
  value,
  onChange,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <td className="px-3 py-3 align-top">
      <input
        className="input h-10 min-w-36 text-xs"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </td>
  );
}

function DomainCell({
  value,
  isEditing,
  onEditToggle,
  onChange,
}: {
  value: string;
  isEditing: boolean;
  onEditToggle: () => void;
  onChange: (value: string) => void;
}) {
  const href = toExternalHref(value);

  return (
    <td className="px-3 py-3 align-top">
      {isEditing ? (
        <div className="flex min-w-44 items-center gap-2">
          <input
            className="input h-10 text-xs"
            type="url"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="https://example.com"
          />
          <button type="button" onClick={onEditToggle} className="btn-ghost px-2.5 py-2 text-xs">
            Done
          </button>
        </div>
      ) : (
        <div className="flex min-w-44 items-center gap-2">
          {value ? (
            <a
              href={href ?? value}
              target="_blank"
              rel="noreferrer"
              className="truncate text-xs font-medium text-accent underline decoration-accent/30 underline-offset-4 transition hover:text-accent-dark hover:decoration-accent"
              title={value}
            >
              {value}
            </a>
          ) : (
            <span className="text-xs text-ink-300">No domain</span>
          )}
          <button type="button" onClick={onEditToggle} className="btn-ghost px-2.5 py-2 text-xs">
            {value ? "Edit" : "Add"}
          </button>
        </div>
      )}
    </td>
  );
}

function toExternalHref(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function SummaryCard({
  label,
  value,
  tone,
  helper,
}: {
  label: string;
  value: number;
  tone: "amber" | "sky" | "emerald" | "rose" | "ink";
  helper: string;
}) {
  const toneClass = {
    amber: "from-amber-50 to-white text-amber-700 ring-amber-100",
    sky: "from-sky-50 to-white text-sky-700 ring-sky-100",
    emerald: "from-emerald-50 to-white text-emerald-700 ring-emerald-100",
    rose: "from-rose-50 to-white text-rose-700 ring-rose-100",
    ink: "from-ink-100 to-white text-ink-700 ring-ink-100",
  }[tone];

  return (
    <div
      className={`rounded-[1.35rem] border border-white/75 bg-gradient-to-br p-4 shadow-[0_22px_65px_-44px_rgba(14,14,8,0.45)] ring-1 ${toneClass}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-ink-900">{value}</p>
      <p className="mt-2 text-xs text-ink-400">{helper}</p>
    </div>
  );
}
