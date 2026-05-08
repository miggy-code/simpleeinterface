"use client";

import { useEffect, useMemo, useState } from "react";
import type { Lead } from "@/lib/schema";
import { apiFetch } from "@/lib/client/api";

interface CampaignStep {
  stepNumber: number;
  delay: number;
  subject: string;
  body: string;
}

interface CampaignStepsResponse {
  campaignName?: string;
  customVariables?: string[];
  defaultHook?: string | null;
  steps?: CampaignStep[];
  error?: string;
}

const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

function variableValues(lead: Lead, hook: string): Record<string, string> {
  return {
    first_name: lead.firstName || lead.name?.split(" ")[0] || "[First]",
    last_name: lead.lastName || "[Last]",
    company_name: lead.companyName || "[Company]",
    personalization_hook: hook || "[personalization_hook]",
    personalization: hook || "[personalization_hook]",
  };
}

function renderTemplateParts(template: string, values: Record<string, string>) {
  const parts: Array<{ text: string; isHook: boolean }> = [];
  let lastIndex = 0;

  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    const fullMatch = match[0];
    const name = match[1];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ text: template.slice(lastIndex, index), isHook: false });
    }
    parts.push({
      text: values[name] ?? fullMatch,
      isHook: name === "personalization_hook" || name === "personalization",
    });
    lastIndex = index + fullMatch.length;
  }

  if (lastIndex < template.length) {
    parts.push({ text: template.slice(lastIndex), isHook: false });
  }

  return parts.length > 0 ? parts : [{ text: template, isHook: false }];
}

function TemplateText({
  template,
  values,
  className,
}: {
  template: string;
  values: Record<string, string>;
  className?: string;
}) {
  const parts = renderTemplateParts(template, values);
  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.isHook ? (
          <mark
            key={index}
            className="rounded-md bg-accent/15 px-1 py-0.5 text-accent-dark ring-1 ring-accent/30"
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </span>
  );
}

export function EmailPreview({
  lead,
  hookOverride,
}: {
  lead: Lead;
  hookOverride?: string;
}) {
  const campaignId = lead.instantlyCampaignId;
  const [data, setData] = useState<CampaignStepsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    if (!campaignId) return;

    let cancelled = false;
    setLoading(true);
    apiFetch<CampaignStepsResponse>(`/api/campaigns/${campaignId}/steps`, {
      fallbackError: "Preview failed",
    })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Preview failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const hook = hookOverride ?? lead.personalizationHook ?? "";
  const values = useMemo(() => variableValues(lead, hook), [lead, hook]);
  const steps = data?.steps ?? [];
  const firstStepHasHook = steps[0]
    ? `${steps[0].subject}\n${steps[0].body}`.includes(
        "{{personalization_hook}}"
      )
    : false;

  if (!campaignId) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Assign this lead to a campaign before generating or reviewing a hook.
      </div>
    );
  }

  if (loading) {
    return <div className="text-sm text-ink-500">Loading campaign email…</div>;
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2">
        <div className="text-xs uppercase tracking-wide text-accent-dark font-semibold">
          Highlighted insertion
        </div>
        <div className="mt-1 font-mono text-sm text-ink-900 whitespace-pre-wrap">
          {hook || "[personalization_hook]"}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-ink-500 font-semibold mb-2">
          Generic campaign email
        </div>
        <div className="space-y-3">
          {steps.length === 0 ? (
            <div className="rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-500">
              No email steps found for this campaign.
            </div>
          ) : (
            steps.map((step) => (
              <div
                key={step.stepNumber}
                className="rounded-md border border-ink-200 bg-white overflow-hidden"
              >
                <div className="px-3 py-2 bg-ink-50 border-b border-ink-100 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-ink-700">
                    Step {step.stepNumber}
                  </span>
                  <span className="text-xs text-ink-400">
                    {step.delay === 0 ? "Initial email" : `+${step.delay} days`}
                  </span>
                </div>
                <div className="px-3 py-2 border-b border-ink-100 text-sm">
                  <span className="text-ink-400">Subject:</span>{" "}
                  {step.subject ? (
                    <TemplateText
                      template={step.subject}
                      values={values}
                      className="font-mono text-ink-800"
                    />
                  ) : (
                    <span className="font-mono text-ink-800">—</span>
                  )}
                </div>
                <div className="whitespace-pre-wrap p-3 font-mono text-xs text-ink-700">
                  {step.body ? (
                    <TemplateText template={step.body} values={values} />
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {!firstStepHasHook && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          The first email does not contain {"{{personalization_hook}}"}. Hook
          generation is disabled until the campaign template includes it.
        </div>
      )}
    </div>
  );
}
