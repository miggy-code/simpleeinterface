import { useMemo } from "react";
import { IcpFit, Industry, Lead, RevenueBand } from "@/lib/schema";

export type LeadQueueHookFilter =
  | "all"
  | "needs-hook"
  | "has-hook"
  | "approved"
  | "assigned"
  | "unassigned";

export interface LeadQueueFilters {
  icpFilter: IcpFit | "All";
  industryFilter: Industry | "All";
  revenueFilter: RevenueBand | "All";
  hookFilter: LeadQueueHookFilter;
  search: string;
}

export function useLeadQueue(
  leads: Lead[],
  filters: LeadQueueFilters,
  selectedIds: Set<string>
) {
  const queueLeads = useMemo(
    () => leads.filter((l) => l.pipelineStatus !== "In Campaign"),
    [leads]
  );

  const filtered = useMemo(() => {
    return queueLeads.filter((l) => {
      if (filters.icpFilter !== "All" && l.icpFit !== filters.icpFilter) return false;
      if (filters.industryFilter !== "All" && l.industry !== filters.industryFilter) return false;
      if (filters.revenueFilter !== "All" && l.revenueBand !== filters.revenueFilter) return false;
      if (filters.hookFilter === "needs-hook" && l.personalizationHook) return false;
      if (filters.hookFilter === "has-hook" && !l.personalizationHook) return false;
      if (filters.hookFilter === "approved" && l.pipelineStatus !== "Approved") return false;
      if (filters.hookFilter === "assigned" && !l.instantlyCampaignId) return false;
      if (filters.hookFilter === "unassigned" && l.instantlyCampaignId) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const name = [l.firstName, l.lastName, l.name].filter(Boolean).join(" ").toLowerCase();
        const company = (l.companyName || "").toLowerCase();
        if (!name.includes(q) && !company.includes(q)) return false;
      }
      return true;
    });
  }, [queueLeads, filters]);

  const selectedLeads = useMemo(
    () => leads.filter((l) => selectedIds.has(l.id)),
    [leads, selectedIds]
  );

  return {
    queueLeads,
    filtered,
    selectedLeads,
    allFilteredSelected:
      filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id)),
    counts: {
      needsHook: queueLeads.filter((l) => !l.personalizationHook).length,
      approved: queueLeads.filter((l) => l.pipelineStatus === "Approved").length,
      assigned: queueLeads.filter((l) => !!l.instantlyCampaignId).length,
      toReview: queueLeads.filter((l) => l.personalizationHook && l.pipelineStatus !== "Approved" && l.pipelineStatus !== "Disqualified").length,
    },
  };
}
