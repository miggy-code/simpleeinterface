"use client";

import { useCallback, useEffect, useState } from "react";
import { sortCampaigns, type CampaignRecord } from "@/lib/campaigns";
import { apiFetch } from "@/lib/client/api";

export function useCampaignRecords() {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ campaigns?: CampaignRecord[] }>(
        "/api/campaigns",
        { fallbackError: "Failed to load campaigns" }
      );
      setCampaigns(sortCampaigns(data.campaigns ?? [], "newest"));
    } catch (err) {
      setCampaigns([]);
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCampaigns();
  }, [refreshCampaigns]);

  return {
    campaigns,
    campaignsLoading: loading,
    campaignsError: error,
    refreshCampaigns,
  };
}
