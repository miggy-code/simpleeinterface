"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INDUSTRIES, Lead } from "@/lib/schema";
import { StatusPill } from "./StatusPill";
import { apiFetch } from "@/lib/client/api";
import { FIXED_CAMPAIGN_BODY, FIXED_CAMPAIGN_SUBJECT } from "@/lib/fixed-campaign";

interface Props {
  lead: Lead;
}

interface Verification {
  email: string;
  decision: "safe" | "blocked" | "missing_email" | "error";
  result?: string;
  reason?: string;
  error?: string;
}

export function LeadDetailClient({ lead: initialLead }: Props) {
  const router = useRouter();
  const [lead, setLead] = useState<Lead>(initialLead);
  const [draft, setDraft] = useState<Partial<Lead>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const merged: Lead = { ...lead, ...draft };
  const dirty = Object.keys(draft).length > 0;

  function setField<K extends keyof Lead>(key: K, value: Lead[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!dirty) return;
    setBusy("save");
    setMsg(null);
    try {
      const data = await apiFetch<{ lead: Lead }>(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
        fallbackError: "Save failed",
      });
      setLead(data.lead);
      setDraft({});
      setMsg({ kind: "ok", text: "Saved" });
      router.refresh();
    } catch (err) {
      setMsg({
        kind: "err",
        text: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(status: "Approved" | "Researching" | "Disqualified") {
    setBusy("status");
    setMsg(null);
    try {
      const data = await apiFetch<{ lead: Lead }>(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineStatus: status }),
        fallbackError: "Status update failed",
      });
      setLead(data.lead);
      setDraft({});
      setMsg({ kind: "ok", text: `Moved to ${status}` });
      router.refresh();
    } catch (err) {
      setMsg({
        kind: "err",
        text: err instanceof Error ? err.message : "Status update failed",
      });
    } finally {
      setBusy(null);
    }
  }

  async function verify() {
    if (dirty) {
      setMsg({ kind: "err", text: "Save changes before running DeBounce." });
      return;
    }
    setBusy("verify");
    setMsg(null);
    try {
      const data = await apiFetch<{
        results: Array<{ id: string; verification: Verification }>;
      }>("/api/leads/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: [lead.id] }),
        fallbackError: "DeBounce verification failed",
      });
      const next = data.results[0]?.verification ?? null;
      setVerification(next);
      setMsg({
        kind: next?.decision === "safe" ? "ok" : "err",
        text:
          next?.decision === "safe"
            ? "DeBounce returned Safe to Send."
            : next?.error || next?.result || "DeBounce did not return Safe to Send.",
      });
    } catch (err) {
      setMsg({
        kind: "err",
        text: err instanceof Error ? err.message : "DeBounce verification failed",
      });
    } finally {
      setBusy(null);
    }
  }

  async function push() {
    if (dirty) {
      setMsg({ kind: "err", text: "Save changes before pushing to Instantly." });
      return;
    }
    setBusy("push");
    setMsg(null);
    try {
      const data = await apiFetch<{ lead: Lead; verification: Verification }>(
        `/api/leads/${lead.id}/push`,
        {
          method: "POST",
          fallbackError: "Push failed",
        }
      );
      setLead(data.lead);
      setVerification(data.verification);
      setMsg({ kind: "ok", text: "Pushed to Instantly" });
      router.refresh();
    } catch (err) {
      setMsg({
        kind: "err",
        text: err instanceof Error ? err.message : "Push failed",
      });
    } finally {
      setBusy(null);
    }
  }

  const missingFields = [
    ["Email", merged.email],
    ["First Name", merged.firstName],
    ["Company Name", merged.companyName],
    ["Title", merged.title],
    ["Industry", merged.industry],
  ].filter(([, value]) => !String(value ?? "").trim());

  return (
    <div className="space-y-6">
      {msg && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            msg.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {merged.name ||
                  [merged.firstName, merged.lastName].filter(Boolean).join(" ") ||
                  "(no name)"}
              </h1>
              <StatusPill status={merged.pipelineStatus} />
            </div>
            <div className="text-sm text-ink-500">
              {merged.title || "No title"} · {merged.companyName || "No company"}
            </div>
            {merged.instantlyCampaignName && (
              <div className="mt-2 text-xs text-ink-400">
                Campaign: {merged.instantlyCampaignName}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={verify}
              disabled={busy !== null || dirty}
              className="btn-secondary"
            >
              {busy === "verify" ? "Verifying..." : "Run DeBounce"}
            </button>
            <button
              onClick={() => setStatus("Approved")}
              disabled={busy !== null || missingFields.length > 0}
              className="btn-primary"
            >
              Approve
            </button>
            <button
              onClick={push}
              disabled={
                busy !== null ||
                dirty ||
                !merged.instantlyCampaignId ||
                missingFields.length > 0
              }
              className="btn-accent"
            >
              {busy === "push" ? "Pushing..." : "Push to Instantly"}
            </button>
          </div>
        </div>
      </div>

      {missingFields.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Missing required template fields:{" "}
          {missingFields.map(([label]) => label).join(", ")}.
        </div>
      )}

      {verification && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            verification.decision === "safe"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          DeBounce: {verification.error || verification.result || verification.decision}
          {verification.reason ? ` (${verification.reason})` : ""}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <section className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Review fields</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name">
              <input
                className="input"
                value={merged.firstName || ""}
                onChange={(event) => setField("firstName", event.target.value)}
              />
            </Field>
            <Field label="Last Name">
              <input
                className="input"
                value={merged.lastName || ""}
                onChange={(event) => setField("lastName", event.target.value)}
              />
            </Field>
          </div>
          <Field label="Email">
            <input
              type="email"
              className="input"
              value={merged.email || ""}
              onChange={(event) => setField("email", event.target.value)}
            />
          </Field>
          <Field label="LinkedIn URL">
            <input
              type="url"
              className="input"
              value={merged.linkedinUrl || ""}
              onChange={(event) => setField("linkedinUrl", event.target.value)}
            />
          </Field>
          <Field label="Title">
            <input
              className="input"
              value={merged.title || ""}
              onChange={(event) => setField("title", event.target.value)}
            />
          </Field>
          <Field label="Company Name">
            <input
              className="input"
              value={merged.companyName || ""}
              onChange={(event) => setField("companyName", event.target.value)}
            />
          </Field>
          <Field label="Company Website / Domain">
            <input
              className="input"
              value={merged.companyDomain || ""}
              onChange={(event) => setField("companyDomain", event.target.value)}
              placeholder="https://example.com"
            />
          </Field>
          <Field label="Industry">
            <select
              className="input"
              value={merged.industry || ""}
              onChange={(event) =>
                setField("industry", (event.target.value || undefined) as Lead["industry"])
              }
            >
              <option value="">Choose industry...</option>
              {INDUSTRIES.map((industry) => (
                <option key={industry}>{industry}</option>
              ))}
            </select>
          </Field>
          <Field label="Notes">
            <textarea
              className="input min-h-[90px]"
              value={merged.notes || ""}
              onChange={(event) => setField("notes", event.target.value)}
            />
          </Field>

          <div className="flex flex-wrap justify-between gap-2 border-t border-ink-100 pt-4">
            <button
              onClick={() => setStatus("Researching")}
              disabled={busy !== null}
              className="btn-secondary text-sm"
            >
              Needs more review
            </button>
            <button
              onClick={() => setStatus("Disqualified")}
              disabled={busy !== null}
              className="btn-secondary border-red-200 text-red-700 hover:bg-red-50 text-sm"
            >
              Disqualify
            </button>
          </div>
        </section>

        <section className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold">Fixed email preview</h2>
            <div className="mt-4 rounded-md border border-ink-200 bg-ink-50 p-3 font-mono text-xs text-ink-700">
              Subject: {renderTemplate(FIXED_CAMPAIGN_SUBJECT, merged)}
            </div>
            <pre className="mt-3 whitespace-pre-wrap rounded-md border border-ink-200 bg-white p-4 text-sm leading-relaxed text-ink-700">
              {renderTemplate(FIXED_CAMPAIGN_BODY, merged)}
            </pre>
          </div>
          <div className="card p-6">
            <h2 className="text-lg font-semibold">Instantly</h2>
            <div className="mt-3 space-y-1 font-mono text-sm text-ink-600">
              <div>Campaign: {merged.instantlyCampaignName || "Not assigned"}</div>
              <div>Campaign ID: {merged.instantlyCampaignId || "—"}</div>
              <div>Lead ID: {merged.instantlyLeadId || "—"}</div>
              {merged.syncErrors && (
                <div className="mt-2 text-xs text-red-700">{merged.syncErrors}</div>
              )}
            </div>
          </div>
        </section>
      </div>

      {dirty && (
        <div className="card fixed bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4 border-ink-300 p-3 px-5 shadow-lg">
          <span className="text-sm text-ink-700">Unsaved changes</span>
          <button
            onClick={() => setDraft({})}
            disabled={busy === "save"}
            className="btn-secondary"
          >
            Discard
          </button>
          <button onClick={save} disabled={busy === "save"} className="btn-primary">
            {busy === "save" ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}

function renderTemplate(template: string, lead: Lead): string {
  return template
    .replaceAll("{{first_name}}", lead.firstName || "[First Name]")
    .replaceAll("{{company_name}}", lead.companyName || "[Company Name]")
    .replaceAll("{{title}}", lead.title || "[Title]")
    .replaceAll("{{industry}}", String(lead.industry || "[Industry]"));
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
