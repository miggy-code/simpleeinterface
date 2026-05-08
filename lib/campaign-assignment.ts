import { getInstantlyCampaign } from "./instantly";
import type { Lead } from "./schema";

export interface CampaignAssignmentValidation {
  campaignId: string;
  campaignName: string;
}

export async function validateCampaignAssignment(
  campaignId: string,
  fetchCampaign = getInstantlyCampaign
): Promise<CampaignAssignmentValidation> {
  const trimmedCampaignId = campaignId.trim();
  if (!trimmedCampaignId) {
    throw new Error("Campaign assignment requires an Instantly campaign ID");
  }

  const campaign = await fetchCampaign(trimmedCampaignId);
  if (!campaign.id || campaign.id !== trimmedCampaignId) {
    throw new Error("Instantly campaign lookup returned a mismatched campaign ID");
  }

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
  };
}

export async function prepareLeadUpdateWithCampaignAssignment(
  update: Partial<Lead>
): Promise<Partial<Lead>> {
  if (typeof update.instantlyCampaignId !== "string") return update;
  if (!update.instantlyCampaignId.trim()) return update;

  const assignment = await validateCampaignAssignment(update.instantlyCampaignId);
  return {
    ...update,
    instantlyCampaignId: assignment.campaignId,
    instantlyCampaignName: assignment.campaignName,
  };
}
