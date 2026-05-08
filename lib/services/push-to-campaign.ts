import { Lead } from "../schema";
import { ValidationError } from "../http/errors";

export interface PushResolution {
  campaignId: string;
  campaignName: string;
}

export function resolveLeadPushContext(
  lead: Lead,
  overrides?: { campaignId?: string; campaignName?: string }
): PushResolution {
  const campaignId = overrides?.campaignId || lead.instantlyCampaignId;
  const campaignName =
    overrides?.campaignName || lead.instantlyCampaignName || campaignId;

  if (!campaignId) {
    throw new ValidationError(
      "campaignId is required or must already be assigned to the lead"
    );
  }
  if (!lead.email) {
    throw new ValidationError("Lead has no email address");
  }

  return { campaignId, campaignName: campaignName || campaignId };
}

export function assertBulkPushEligible(lead: Lead): void {
  if (!lead.firstName?.trim()) {
    throw new ValidationError("First Name is required for the fixed template");
  }
  if (!lead.email?.trim()) {
    throw new ValidationError("Email is required for the fixed template");
  }
  if (!lead.companyName?.trim()) {
    throw new ValidationError("Company Name is required for the fixed template");
  }
  if (!lead.title?.trim()) {
    throw new ValidationError("Title is required for the fixed template");
  }
  if (!lead.industry?.trim()) {
    throw new ValidationError("Industry is required for the fixed template");
  }
}
