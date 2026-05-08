"use client";

import { apiFetch } from "@/lib/client/api";
import type { Lead } from "@/lib/schema";
import type { CampaignRecord } from "@/lib/campaigns";

export interface GenResult {
  id: string;
  status: "ok" | "error";
  hook?: string;
  confidence?: string;
  hookSource?: string;
  appliedDefault?: boolean;
  error?: string;
}

export function useIngestionMutations() {
  async function assignCampaign(
    leadIds: string[],
    campaign: CampaignRecord
  ): Promise<Lead[]> {
    const responses = await Promise.all(
      leadIds.map((id) =>
        apiFetch<{ lead?: Lead }>(`/api/leads/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instantlyCampaignId: campaign.id,
            instantlyCampaignName: campaign.name,
          }),
          fallbackError: "Failed to assign campaign",
        })
      )
    );
    return responses.map((res) => {
      if (!res.lead) throw new Error("Campaign assignment did not return a lead");
      return res.lead;
    });
  }

  async function batchPersonalize(leadIds: string[]): Promise<GenResult[]> {
    const data = await apiFetch<{ results?: GenResult[] }>(
      "/api/leads/batch-personalize",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: leadIds }),
        fallbackError: "Failed to generate hooks",
      }
    );
    return data.results ?? [];
  }

  async function deleteLeads(leadIds: string[]): Promise<void> {
    await Promise.all(
      leadIds.map((id) =>
        apiFetch(`/api/leads/${id}`, {
          method: "DELETE",
          fallbackError: "Failed to delete lead",
        })
      )
    );
  }

  async function approveLead(lead: Lead): Promise<void> {
    await apiFetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pipelineStatus: "Approved",
        personalizationReviewed: true,
      }),
      fallbackError: "Approve failed",
    });
  }

  return {
    assignCampaign,
    batchPersonalize,
    deleteLeads,
    approveLead,
  };
}
