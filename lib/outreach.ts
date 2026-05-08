import { updateLead } from "./airtable";
import { createInstantlyLead } from "./instantly";
import { Lead } from "./schema";

export interface PushLeadInput {
  lead: Lead;
  campaignId?: string;
  campaignName?: string;
}

export async function pushLeadToInstantly({
  lead,
  campaignId,
  campaignName,
}: PushLeadInput): Promise<Lead> {
  const resolvedCampaignId = campaignId || lead.instantlyCampaignId;
  const resolvedCampaignName =
    campaignName || lead.instantlyCampaignName || resolvedCampaignId;

  if (!resolvedCampaignId) {
    throw new Error("campaignId is required or must already be assigned to the lead");
  }
  if (!lead.email) {
    throw new Error("Lead has no email address");
  }

  const instantlyLead = await createInstantlyLead({
    campaign: resolvedCampaignId,
    email: lead.email,
    first_name: lead.firstName,
    last_name: lead.lastName,
    company_name: lead.companyName,
    website: lead.companyDomain,
    company_domain: normalizeDomain(lead.companyDomain),
    custom_variables: {
      title: lead.title ?? "",
      industry: lead.industry ?? "",
      company_domain: normalizeDomain(lead.companyDomain) ?? "",
      linkedin_url: lead.linkedinUrl ?? "",
    },
  });

  return updateLead(lead.id, {
    instantlyLeadId: instantlyLead.id,
    instantlyCampaignId: resolvedCampaignId,
    instantlyCampaignName: resolvedCampaignName,
    initialOutreachDate: new Date().toISOString(),
    pipelineStatus: "In Campaign",
    syncErrors: "",
  });
}

function normalizeDomain(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}
