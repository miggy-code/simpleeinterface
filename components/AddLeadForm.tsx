"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DECISION_MAKER_ROLES,
  ICP_FITS,
  INDUSTRIES,
  Lead,
  LEAD_SOURCES,
  REVENUE_BANDS,
} from "@/lib/schema";

export function AddLeadForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<Partial<Lead>>({
    pipelineStatus: "Researching",
    source: "Manual",
    icpFit: "Unscored",
  });

  function set<K extends keyof Lead>(key: K, value: Lead[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  // Sync the "Name" primary field automatically from First+Last if user hasn't typed it.
  const computedName =
    draft.name ||
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") ||
    "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { ...draft, name: computedName };
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.existingLead) {
          setError(
            `Duplicate — a lead with this email/domain already exists. Existing record: ${data.existingLead.name || data.existingLead.companyName}`
          );
          return;
        }
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      router.push(`/leads/${data.lead.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-6 space-y-4">
      {error && (
        <div className="text-sm px-4 py-3 rounded-md border bg-red-50 border-red-200 text-red-700">
          {error}
        </div>
      )}

      <h2 className="text-lg font-semibold">Identity</h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First Name">
          <input
            className="input"
            value={draft.firstName || ""}
            onChange={(e) => set("firstName", e.target.value)}
            required
          />
        </Field>
        <Field label="Last Name">
          <input
            className="input"
            value={draft.lastName || ""}
            onChange={(e) => set("lastName", e.target.value)}
            required
          />
        </Field>
      </div>
      <Field label="Email">
        <input
          type="email"
          className="input"
          value={draft.email || ""}
          onChange={(e) => set("email", e.target.value)}
        />
      </Field>
      <Field label="Title">
        <input
          className="input"
          value={draft.title || ""}
          onChange={(e) => set("title", e.target.value)}
        />
      </Field>
      <Field label="LinkedIn URL">
        <input
          type="url"
          className="input"
          value={draft.linkedinUrl || ""}
          onChange={(e) => set("linkedinUrl", e.target.value)}
        />
      </Field>

      <h2 className="text-lg font-semibold pt-4 border-t border-ink-100">
        Company
      </h2>
      <Field label="Company Name">
        <input
          className="input"
          value={draft.companyName || ""}
          onChange={(e) => set("companyName", e.target.value)}
          required
        />
      </Field>
      <Field label="Company Domain">
        <input
          type="url"
          className="input"
          value={draft.companyDomain || ""}
          onChange={(e) => set("companyDomain", e.target.value)}
          placeholder="https://example.com"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Industry">
          <select
            className="input"
            value={draft.industry || ""}
            onChange={(e) =>
              set("industry", (e.target.value || undefined) as Lead["industry"])
            }
          >
            <option value="">—</option>
            {INDUSTRIES.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
        </Field>
        <Field label="Revenue Band">
          <select
            className="input"
            value={draft.revenueBand || ""}
            onChange={(e) =>
              set(
                "revenueBand",
                (e.target.value || undefined) as Lead["revenueBand"]
              )
            }
          >
            <option value="">—</option>
            {REVENUE_BANDS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City">
          <input
            className="input"
            value={draft.city || ""}
            onChange={(e) => set("city", e.target.value)}
          />
        </Field>
        <Field label="State">
          <input
            className="input"
            value={draft.state || ""}
            onChange={(e) => set("state", e.target.value)}
          />
        </Field>
      </div>

      <h2 className="text-lg font-semibold pt-4 border-t border-ink-100">
        ICP & Source
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ICP Fit">
          <select
            className="input"
            value={draft.icpFit || ""}
            onChange={(e) =>
              set("icpFit", (e.target.value || undefined) as Lead["icpFit"])
            }
          >
            {ICP_FITS.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
        </Field>
        <Field label="Decision Maker Role">
          <select
            className="input"
            value={draft.decisionMakerRole || ""}
            onChange={(e) =>
              set(
                "decisionMakerRole",
                (e.target.value || undefined) as Lead["decisionMakerRole"]
              )
            }
          >
            <option value="">—</option>
            {DECISION_MAKER_ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Source">
        <select
          className="input"
          value={draft.source || ""}
          onChange={(e) =>
            set("source", (e.target.value || undefined) as Lead["source"])
          }
        >
          {LEAD_SOURCES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
      <Field label="Source Detail">
        <input
          className="input"
          value={draft.sourceDetail || ""}
          onChange={(e) => set("sourceDetail", e.target.value)}
          placeholder="e.g., Inc 5000 NE 2025, referral from Steve, Worcester mfg search"
        />
      </Field>
      <Field label="Source URL">
        <input
          type="url"
          className="input"
          value={draft.sourceUrl || ""}
          onChange={(e) => set("sourceUrl", e.target.value)}
        />
      </Field>
      <Field label="Notes">
        <textarea
          className="input min-h-[80px]"
          value={draft.notes || ""}
          onChange={(e) => set("notes", e.target.value)}
        />
      </Field>
      <Field label="Personalization Insights (factoids)">
        <textarea
          className="input min-h-[100px] font-mono text-xs"
          value={draft.personalizationInsights || ""}
          onChange={(e) => set("personalizationInsights", e.target.value)}
          placeholder="- Named to ... [URL]&#10;- Recent news ... [URL]"
        />
      </Field>

      <div className="flex justify-end gap-2 pt-4 border-t border-ink-100">
        <button
          type="submit"
          disabled={busy}
          className="btn-primary"
        >
          {busy ? "Creating…" : "Create lead"}
        </button>
      </div>
    </form>
  );
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
