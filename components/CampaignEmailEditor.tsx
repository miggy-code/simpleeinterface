"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CampaignRecord } from "@/lib/campaigns";
import { FIXED_CAMPAIGN_EMAILS } from "@/lib/fixed-campaign";
import { apiFetch } from "@/lib/client/api";
import { useCampaignRecords } from "./campaigns/useCampaignRecords";
import { THROTTL_STARTER_SEQUENCE_DELAYS } from "@/lib/campaign-sequence";

interface EmailStep {
  step: number;
  subject: string;
  body: string;
  delayDays: number;
}

interface CampaignStepsResponse {
  campaignName?: string;
  steps?: Array<{
    step?: number;
    stepNumber?: number;
    subject?: string;
    body?: string;
    delay?: number;
    delayDays?: number;
  }>;
}

const ALLOWED_VARIABLES = [
  "{{first_name}}",
  "{{company_name}}",
  "{{title}}",
  "{{industry}}",
];

function HighlightedBody({ text }: { text: string }) {
  const parts = text.split(/({{[^}]+}})/g);
  return (
    <span>
      {parts.map((part, i) =>
        /^{{[^}]+}}$/.test(part) ? (
          <mark
            key={i}
            className="rounded bg-amber-100 px-0.5 font-mono text-xs text-amber-800"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

function extractVariables(text: string): string[] {
  const matches = text.match(/{{[^}]+}}/g) || [];
  return [...new Set(matches)];
}

function normalizeSteps(steps: EmailStep[]): EmailStep[] {
  return steps.map((step, index) => ({
    ...step,
    step: index + 1,
    delayDays: index === 0 ? 0 : Math.max(0, Number(step.delayDays) || 0),
  }));
}

function newFollowUp(stepNumber: number): EmailStep {
  const isSecondFollowUp = stepNumber === 2;
  return {
    step: stepNumber,
    subject: isSecondFollowUp
      ? "Following up on {{company_name}}"
      : "Checking in on {{company_name}}",
    body: isSecondFollowUp
      ? "Hi {{first_name}},\n\nJust wanted to bump this back to the top of your inbox.\n\nHappy to send a few practical ideas if useful."
      : "Hi {{first_name}},\n\nCircling back one last time in case this got buried.\n\nIf timing is better later, I’m happy to reconnect then.",
    delayDays: stepNumber === 2 ? 3 : 5,
  };
}

function StepEditor({
  step,
  index,
  total,
  onChange,
  onMove,
  onDelete,
}: {
  step: EmailStep;
  index: number;
  total: number;
  onChange: (index: number, patch: Partial<EmailStep>) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onDelete: (index: number) => void;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const variables = extractVariables(`${step.subject} ${step.body}`);

  return (
    <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-3 bg-ink-50 px-5 py-4 text-left transition-colors hover:bg-ink-100"
      >
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-ink-900">
            {step.subject || <span className="italic text-ink-400">No subject</span>}
          </div>
          <div className="mt-0.5 text-xs text-ink-500">
            {index === 0 ? "Day 0" : `After ${step.delayDays} day${step.delayDays === 1 ? "" : "s"}`}
          </div>
        </div>
        {variables.slice(0, 3).map((variable) => (
          <span
            key={variable}
            className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs text-amber-700"
          >
            {variable}
          </span>
        ))}
        <span className="text-xs text-ink-400">{expanded ? "Collapse" : "Edit"}</span>
      </button>

      {expanded && (
        <div className="space-y-4 p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_140px]">
            <div>
              <label className="label">Subject</label>
              <input
                className="input font-medium"
                value={step.subject}
                onChange={(event) => onChange(index, { subject: event.target.value })}
                placeholder="Email subject"
              />
            </div>
            <div>
              <label className="label">Delay days</label>
              <input
                className="input"
                type="number"
                min={0}
                value={step.delayDays}
                disabled={index === 0}
                onChange={(event) =>
                  onChange(index, { delayDays: Number(event.target.value) })
                }
              />
            </div>
          </div>
          <div>
            <label className="label">Body</label>
            <textarea
              className="input resize-y font-mono text-xs leading-relaxed"
              rows={12}
              value={step.body}
              onChange={(event) => onChange(index, { body: event.target.value })}
              placeholder="Email body"
            />
          </div>
          <div className="rounded-lg border border-ink-200 bg-ink-50 px-4 py-3">
            <p className="mb-2 text-xs font-semibold text-ink-600">Preview</p>
            <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-ink-700">
              <HighlightedBody text={step.body || "(no body)"} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onMove(index, -1)}
              disabled={index === 0}
              className="btn-secondary text-sm"
            >
              Move up
            </button>
            <button
              type="button"
              onClick={() => onMove(index, 1)}
              disabled={index === total - 1}
              className="btn-secondary text-sm"
            >
              Move down
            </button>
            <button
              type="button"
              onClick={() => onDelete(index)}
              className="btn-ghost text-sm text-red-700"
            >
              Delete step
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CampaignEmailEditor() {
  const searchParams = useSearchParams();
  const requestedId = searchParams?.get("id") ?? null;
  const {
    campaigns,
    campaignsLoading,
    campaignsError,
    refreshCampaigns,
  } = useCampaignRecords();
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [steps, setSteps] = useState<EmailStep[]>([]);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [stepsError, setStepsError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );

  useEffect(() => {
    if (campaigns.length === 0) return;
    if (selectedCampaignId && campaigns.some((c) => c.id === selectedCampaignId)) {
      return;
    }
    const fromQuery =
      requestedId && campaigns.some((c) => c.id === requestedId)
        ? requestedId
        : null;
    setSelectedCampaignId(fromQuery ?? campaigns[0].id);
  }, [campaigns, requestedId, selectedCampaignId]);

  const loadSteps = useCallback(async (campaignId: string) => {
    if (!campaignId) return;
    setStepsLoading(true);
    setStepsError(null);
    setMessage(null);
    try {
      const data = await apiFetch<CampaignStepsResponse>(
        `/api/campaigns/${campaignId}/steps`,
        { fallbackError: "Failed to load campaign steps" }
      );
      setSteps(
        normalizeSteps(
          (data.steps || []).map((step, index) => ({
            step: step.step ?? step.stepNumber ?? index + 1,
            subject: step.subject ?? "",
            body: step.body ?? "",
            delayDays: step.delayDays ?? step.delay ?? 0,
          }))
        )
      );
      setDirty(false);
    } catch (err) {
      setStepsError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setStepsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCampaignId) loadSteps(selectedCampaignId);
  }, [selectedCampaignId, loadSteps]);

  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId);
  const variablesInUse = useMemo(
    () => extractVariables(steps.map((step) => `${step.subject} ${step.body}`).join(" ")),
    [steps]
  );

  function updateStep(index: number, patch: Partial<EmailStep>) {
    setSteps((prev) =>
      normalizeSteps(prev.map((step, i) => (i === index ? { ...step, ...patch } : step)))
    );
    setDirty(true);
  }

  function moveStep(index: number, direction: -1 | 1) {
    setSteps((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return normalizeSteps(next);
    });
    setDirty(true);
  }

  function deleteStep(index: number) {
    setSteps((prev) => normalizeSteps(prev.filter((_, i) => i !== index)));
    setDirty(true);
  }

  function addStep() {
    setSteps((prev) => normalizeSteps([...prev, newFollowUp(prev.length + 1)]));
    setDirty(true);
  }

  function resetToStarter() {
    setSteps(
      normalizeSteps(
        FIXED_CAMPAIGN_EMAILS.map((email, index) => ({
          step: index + 1,
          subject: email.subject,
          body: email.body,
          delayDays: THROTTL_STARTER_SEQUENCE_DELAYS[index] ?? 5,
        }))
      )
    );
    setDirty(true);
  }

  async function saveSequence() {
    if (!selectedCampaignId || steps.length === 0) return;
    setSaving(true);
    setMessage(null);
    try {
      const cleanSteps = normalizeSteps(steps).map((step) => ({
        subject:
          step.subject.trim().charAt(0).toUpperCase() + step.subject.trim().slice(1),
        body: step.body.trim(),
        delayDays: step.delayDays,
      }));
      await apiFetch(`/api/campaigns/${selectedCampaignId}/email`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: cleanSteps }),
        fallbackError: "Failed to save campaign sequence",
      });
      setSteps(normalizeSteps(cleanSteps.map((step, index) => ({ ...step, step: index + 1 }))));
      setDirty(false);
      setMessage({ kind: "ok", text: "Sequence saved to Instantly." });
      await refreshCampaigns();
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Failed to save campaign sequence",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-48 flex-1">
            <label className="label">Campaign</label>
            {campaignsLoading ? (
              <div className="input animate-pulse text-sm text-ink-400">Loading...</div>
            ) : (
              <select
                className="input"
                value={selectedCampaignId}
                onChange={(event) => setSelectedCampaignId(event.target.value)}
              >
                <option value="">Select a campaign...</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {formatCampaignOption(campaign)}
                  </option>
                ))}
              </select>
            )}
          </div>
          {selectedCampaign && (
            <div className="pb-2 text-xs text-ink-500">
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                  selectedCampaign.status === "Active"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-ink-200 bg-ink-50 text-ink-500"
                }`}
              >
                {selectedCampaign.status}
              </span>
              {selectedCampaign.createdAt && (
                <span className="ml-2 text-ink-400">
                  Created {formatPickerDate(selectedCampaign.createdAt)}
                </span>
              )}
            </div>
          )}
          {selectedCampaignId && (
            <button
              type="button"
              onClick={() => loadSteps(selectedCampaignId)}
              className="btn-ghost pb-2 text-sm"
            >
              Refresh sequence
            </button>
          )}
          <button
            type="button"
            onClick={() => refreshCampaigns()}
            className="btn-ghost pb-2 text-sm"
          >
            Refresh campaigns
          </button>
        </div>
        {campaignsError && <p className="mt-3 text-xs text-red-600">{campaignsError}</p>}
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Allowed merge variables</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALLOWED_VARIABLES.map((variable) => (
                <span
                  key={variable}
                  className="badge border-ink-200 bg-ink-50 font-mono text-ink-700"
                >
                  {variable}
                </span>
              ))}
            </div>
          </div>
          {variablesInUse.length > 0 && (
            <div className="text-right">
              <p className="text-xs font-semibold text-ink-500">Variables in sequence</p>
              <div className="mt-2 flex max-w-md flex-wrap justify-end gap-2">
                {variablesInUse.map((variable) => (
                  <span
                    key={variable}
                    className={`badge font-mono ${
                      ALLOWED_VARIABLES.includes(variable)
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    {variable}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            message.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {!selectedCampaignId ? (
        <div className="card p-12 text-center text-sm text-ink-500">
          Select a campaign to edit its email sequence.
        </div>
      ) : stepsLoading ? (
        <div className="card p-12 text-center">
          <div className="mb-3 inline-block h-5 w-5 animate-spin rounded-full border-2 border-ink-300 border-t-ink-700" />
          <p className="text-sm text-ink-500">Loading email steps from Instantly...</p>
        </div>
      ) : stepsError ? (
        <div className="card border-red-200 p-8 text-center">
          <p className="text-sm text-red-600">{stepsError}</p>
          <button
            type="button"
            onClick={() => loadSteps(selectedCampaignId)}
            className="btn-secondary mt-3 text-sm"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-600">
              <span className="font-semibold">{steps.length}</span> email step
              {steps.length === 1 ? "" : "s"}
              {dirty && <span className="ml-2 text-amber-700">Unsaved changes</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={resetToStarter} className="btn-secondary text-sm">
                Reset to Throttl first email
              </button>
              <button type="button" onClick={addStep} className="btn-secondary text-sm">
                Add follow-up
              </button>
              <button
                type="button"
                onClick={saveSequence}
                disabled={saving || !dirty || steps.length === 0}
                className="btn-primary text-sm"
              >
                {saving ? "Saving..." : "Save full sequence"}
              </button>
            </div>
          </div>

          {steps.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-sm text-ink-500">No email steps in this campaign.</p>
              <button type="button" onClick={resetToStarter} className="btn-primary mt-4 text-sm">
                Add Throttl first email
              </button>
            </div>
          ) : (
            steps.map((step, index) => (
              <StepEditor
                key={`${step.step}-${index}`}
                step={step}
                index={index}
                total={steps.length}
                onChange={updateStep}
                onMove={moveStep}
                onDelete={deleteStep}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function formatCampaignOption(campaign: CampaignRecord) {
  const created = campaign.createdAt ? formatPickerDate(campaign.createdAt) : "unknown";
  return `${campaign.name} - ${campaign.status} - ${created}`;
}

function formatPickerDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
