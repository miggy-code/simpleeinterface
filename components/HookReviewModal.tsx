"use client";

/**
 * Hook review modal — queue mode.
 *
 * Renders one lead at a time with arrow-key navigation. The operator can:
 *   • Approve current hook (status → Approved)
 *   • Edit and save the hook without approving it
 *   • Revert to the campaign's default hook (Instantly custom_variables.default_hook)
 *   • Skip (advance without changes)
 *   • Disqualify (status → Disqualified)
 *   • Exit (Esc) — calls `onClose` with a summary
 *
 * Props match the call from `IngestionDashboard.tsx`:
 *   <HookReviewModal leads={Lead[]} startIndex={number} onClose={callback} />
 *
 * No shadcn / lucide deps — uses global classes from `app/globals.css`.
 */

import { useEffect, useState, useCallback } from "react";
import type { Lead } from "@/lib/schema";
import { EmailPreview } from "./EmailPreview";
import { apiFetch } from "@/lib/client/api";

interface Props {
  leads: Lead[];
  startIndex?: number;
  /** Called when the modal closes. Receives per-lead actions. */
  onClose: (
    results: Array<{
      id: string;
      action: ReviewAction;
      hook?: string;
    }>
  ) => void;
}

export type ReviewAction = "approved" | "edited" | "skipped" | "disqualified";
export interface ReviewResult {
  id: string;
  action: ReviewAction;
  hook?: string;
}

const CONFIDENCE_BADGE: Record<string, string> = {
  High: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Medium: "bg-amber-100 text-amber-800 border-amber-200",
  Low: "bg-ink-100 text-ink-600 border-ink-200",
};

interface CampaignHookResponse {
  defaultHook?: string | null;
  error?: string;
}

function upsertResult(results: ReviewResult[], nextResult: ReviewResult) {
  const existing = results.findIndex((r) => r.id === nextResult.id);
  if (existing === -1) return [...results, nextResult];
  const next = [...results];
  next[existing] = nextResult;
  return next;
}

export default function HookReviewModal({
  leads,
  startIndex = 0,
  onClose,
}: Props) {
  const [index, setIndex] = useState(
    Math.min(Math.max(0, startIndex), Math.max(0, leads.length - 1))
  );
  const lead = leads[index];

  const [hookText, setHookText] = useState(lead?.personalizationHook ?? "");
  const [busy, setBusy] = useState<null | "save" | "approve" | "revert" | "disqualify">(
    null
  );
  const [savedHook, setSavedHook] = useState(lead?.personalizationHook ?? "");
  const [hookOverrides, setHookOverrides] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ReviewResult[]>([]);

  const recordAction = useCallback(
    (id: string, action: ReviewAction, hook?: string) => {
      setResults((prev) => {
        return upsertResult(prev, { id, action, hook });
      });
    },
    []
  );

  const commitAndAdvance = useCallback(
    (nextResult: ReviewResult) => {
      const nextResults = upsertResult(results, nextResult);
      setResults(nextResults);
      if (index < leads.length - 1) {
        setIndex(index + 1);
      } else {
        onClose(nextResults);
      }
    },
    [index, leads.length, onClose, results]
  );

  // Reset hook text when navigating
  useEffect(() => {
    const nextLead = leads[index];
    const nextHook = nextLead
      ? hookOverrides[nextLead.id] ?? nextLead.personalizationHook ?? ""
      : "";
    setHookText(nextHook);
    setSavedHook(nextHook);
    setError(null);
  }, [hookOverrides, index, leads]);

  const advance = useCallback(() => {
    if (index < leads.length - 1) {
      setIndex(index + 1);
    } else {
      onClose(results);
    }
  }, [index, leads.length, results, onClose]);

  const goBack = useCallback(() => {
    if (index > 0) setIndex(index - 1);
  }, [index]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore when an input/textarea has focus and user is typing
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (e.key === "Escape") {
        e.preventDefault();
        onClose(results);
        return;
      }
      if (inField) return;
      if (e.key === "ArrowRight") advance();
      else if (e.key === "ArrowLeft") goBack();
      else if (e.key === "Enter") {
        // Enter = approve current
        e.preventDefault();
        void handleApprove();
      } else if (e.key.toLowerCase() === "d") {
        e.preventDefault();
        void handleRevert();
      } else if (e.key.toLowerCase() === "x") {
        e.preventDefault();
        void handleDisqualify();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, hookText, advance, goBack, results]);

  if (!lead) {
    // Empty state — closes immediately
    onClose(results);
    return null;
  }

  // ── Action handlers ───────────────────────────────────────────────────────

  async function patchLead(payload: Record<string, unknown>): Promise<boolean> {
    try {
      await apiFetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        fallbackError: "Save failed",
      });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      return false;
    }
  }

  async function handleSaveEdit() {
    if (busy) return;
    setBusy("save");
    setError(null);
    const ok = await patchLead({
      personalizationHook: hookText.trim(),
      personalizationReviewed: false,
      personalizationHookSource: "Manual Edit",
      pipelineStatus: "Personalized",
    });
    setBusy(null);
    if (ok) {
      setSavedHook(hookText.trim());
      setHookOverrides((prev) => ({ ...prev, [lead.id]: hookText.trim() }));
      recordAction(lead.id, "edited", hookText.trim());
    }
  }

  async function handleApprove() {
    if (busy) return;
    setBusy("approve");
    setError(null);
    // If the operator edited the hook, save the edit too
    const payload: Record<string, unknown> = {
      pipelineStatus: "Approved",
      personalizationReviewed: true,
    };
    if (hookText.trim() !== savedHook) {
      payload.personalizationHook = hookText.trim();
      payload.personalizationHookSource = "Manual Edit";
    }
    const ok = await patchLead(payload);
    setBusy(null);
    if (ok) {
      commitAndAdvance({
        id: lead.id,
        action: "approved",
        hook: hookText.trim(),
      });
    }
  }

  async function handleRevert() {
    if (busy || !lead.instantlyCampaignId) {
      if (!lead.instantlyCampaignId) {
        setError(
          "No Instantly campaign assigned to this lead — can't revert to default."
        );
      }
      return;
    }
    setBusy("revert");
    setError(null);
    try {
      const data = await apiFetch<{ lead?: { personalizationHook?: string } }>(
        `/api/leads/${lead.id}/revert-hook`,
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: lead.instantlyCampaignId }),
          fallbackError: "Revert failed",
        }
      );
      const revertedHook = data?.lead?.personalizationHook ?? hookText;
      setHookText(revertedHook);
      setSavedHook(revertedHook);
      commitAndAdvance({
        id: lead.id,
        action: "approved",
        hook: revertedHook,
      }); // reverted = treated as approved with default
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revert failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleDisqualify() {
    if (busy) return;
    setBusy("disqualify");
    setError(null);
    const ok = await patchLead({
      pipelineStatus: "Disqualified",
      personalizationReviewed: true,
    });
    setBusy(null);
    if (ok) {
      commitAndAdvance({
        id: lead.id,
        action: "disqualified",
        hook: hookText.trim(),
      });
    }
  }

  function handleSkip() {
    commitAndAdvance({ id: lead.id, action: "skipped" });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const confidence = lead.personalizationConfidence;
  const hookSource = lead.personalizationHookSource;
  const badgeClass = confidence
    ? CONFIDENCE_BADGE[confidence] ?? "bg-ink-100 text-ink-600 border-ink-200"
    : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => onClose(results)}
    >
      <div
        className="bg-white rounded-xl shadow-xl border border-ink-200 max-w-6xl w-full max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-ink-400 font-mono">
              {index + 1} / {leads.length}
            </p>
            <h3 className="text-base font-semibold text-ink-900 mt-0.5 truncate">
              Review and approve hook — {lead.companyName ?? lead.email ?? lead.id}
            </h3>
          </div>
          <button
            onClick={() => onClose(results)}
            className="text-ink-400 hover:text-ink-700"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section className="space-y-4">
              <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {badgeClass && (
                    <span className={`badge ${badgeClass}`}>
                      {confidence} confidence
                    </span>
                  )}
                  {lead.pipelineStatus && (
                    <span className="badge bg-white text-ink-600 border-ink-200">
                      {lead.pipelineStatus}
                    </span>
                  )}
                  {hookSource && (
                    <span className="badge bg-blue-50 text-blue-700 border-blue-200">
                      {hookSource}
                    </span>
                  )}
                  {lead.instantlyCampaignName && (
                    <span className="badge bg-violet-50 text-violet-700 border-violet-200">
                      {lead.instantlyCampaignName}
                    </span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-ink-600 sm:grid-cols-2">
                  <p>
                    <span className="text-ink-400">Contact:</span>{" "}
                    {[lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
                      lead.email ||
                      "(unknown)"}
                  </p>
                  <p>
                    <span className="text-ink-400">Title:</span>{" "}
                    {lead.title || "—"}
                  </p>
                  <p>
                    <span className="text-ink-400">Industry:</span>{" "}
                    {lead.industry || "—"}
                  </p>
                  <p>
                    <span className="text-ink-400">Location:</span>{" "}
                    {[lead.city, lead.state].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
              </div>

              <div>
                <label className="label">Personalization hook</label>
                <textarea
                  className="input min-h-[128px] font-mono text-sm leading-relaxed"
                  value={hookText}
                  onChange={(e) => setHookText(e.target.value)}
                  placeholder="Verb-led clause that completes 'I came across [Company] and ___'"
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-ink-400">
                    Save keeps the draft editable. Approve commits the final hook.
                  </p>
                  <span className="text-xs text-ink-300 font-mono">
                    {hookText.length}/280
                  </span>
                </div>
              </div>

              {lead.personalizationHook && (
                <DefaultHookComparison
                  campaignId={lead.instantlyCampaignId}
                  personalizedHook={hookText}
                  defaultHookSnapshot={lead.campaignDefaultHookSnapshot}
                  aiCandidate={lead.personalizationAiCandidate}
                />
              )}

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-ink-900">
                  Research signals
                </h4>
                {lead.personalizationInsights ? (
                  <div className="max-h-52 overflow-y-auto rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-600 whitespace-pre-wrap">
                    {lead.personalizationInsights}
                  </div>
                ) : (
                  <div className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-400">
                    No sourcing insights are attached to this lead.
                  </div>
                )}
                {lead.personalizationNotes && (
                  <details className="border border-ink-200 rounded-md">
                    <summary className="px-3 py-2 text-sm font-medium text-ink-700 cursor-pointer hover:bg-ink-50">
                      AI reasoning
                    </summary>
                    <div className="px-3 py-2 text-sm text-ink-600 whitespace-pre-wrap border-t border-ink-100">
                      {lead.personalizationNotes}
                    </div>
                  </details>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-ink-200 bg-ink-50/40 p-4">
              <h4 className="text-sm font-semibold text-ink-900 mb-3">
                Rendered campaign email
              </h4>
              <EmailPreview lead={lead} hookOverride={hookText} />
            </section>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-ink-200 bg-ink-50 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={goBack}
              disabled={index === 0 || !!busy}
              className="btn-ghost text-sm"
            >
              ← Prev
            </button>
            <button
              onClick={handleSkip}
              disabled={!!busy}
              className="btn-secondary text-sm"
            >
              Skip
            </button>
            <button
              onClick={handleDisqualify}
              disabled={!!busy}
              className="btn-secondary text-sm border-red-200 text-red-700 hover:bg-red-50"
            >
              {busy === "disqualify" ? "Disqualifying…" : "Disqualify"}
            </button>
            <button
              onClick={handleRevert}
              disabled={!!busy || !lead.instantlyCampaignId}
              className="btn-secondary text-sm"
              title={
                lead.instantlyCampaignId
                  ? "Revert to campaign default hook (D)"
                  : "No Instantly campaign assigned"
              }
            >
              {busy === "revert" ? "Reverting…" : "Revert to default"}
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleSaveEdit}
              disabled={
                !!busy ||
                hookText.trim() === savedHook ||
                !hookText.trim()
              }
              className="btn-secondary text-sm"
            >
              {busy === "save" ? "Saving…" : "Save edit"}
            </button>
            <button
              onClick={handleApprove}
              disabled={!!busy || !hookText.trim()}
              className="btn-primary text-sm px-5"
            >
              {busy === "approve" ? "Approving…" : "Approve →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DefaultHookComparison({
  campaignId,
  personalizedHook,
  defaultHookSnapshot,
  aiCandidate,
}: {
  campaignId?: string;
  personalizedHook: string;
  defaultHookSnapshot?: string;
  aiCandidate?: string;
}) {
  const [open, setOpen] = useState(false);
  const [defaultHook, setDefaultHook] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !campaignId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<CampaignHookResponse>(`/api/campaigns/${campaignId}/steps`, {
      fallbackError: "Default hook lookup failed",
    })
      .then((json) => {
        if (!cancelled) setDefaultHook(json.defaultHook || null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Default hook lookup failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, open]);

  return (
    <div className="rounded-lg border border-ink-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-ink-900">
            Compare with campaign default
          </span>
          <span className="block text-xs text-ink-400">
            Optional check before approving this personalized hook.
          </span>
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-accent">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && (
        <div className="grid gap-3 border-t border-ink-100 p-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              Default used when generated
            </div>
            <div className="min-h-20 rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-700">
              {defaultHookSnapshot || "No default snapshot stored on this lead."}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              Current campaign default
            </div>
            <div className="min-h-20 rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-700">
              {loading
                ? "Loading default hook..."
                : error
                ? error
                : defaultHook || "No default_hook is set on this campaign."}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              Stored hook
            </div>
            <div className="min-h-20 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-ink-900">
              {personalizedHook || "No personalized hook yet."}
            </div>
          </div>
          {aiCandidate && (
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                AI candidate
              </div>
              <div className="min-h-20 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {aiCandidate}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
