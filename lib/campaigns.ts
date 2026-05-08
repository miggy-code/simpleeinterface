import type {
  InstantlyCampaignAnalyticsOverview,
  InstantlyCampaignSummary,
} from "@/lib/instantly";

export type CampaignStatusCode = -99 | -1 | -2 | 0 | 1 | 2 | 3 | 4;

export const CAMPAIGN_STATUS_LABELS: Record<number, string> = {
  "-99": "Account Suspended",
  "-1": "Accounts Unhealthy",
  "-2": "Bounce Protect",
  0: "Draft",
  1: "Active",
  2: "Paused",
  3: "Completed",
  4: "Running Subsequences",
};

export const CAMPAIGN_NOT_SENDING_STATUS_LABELS: Record<number, string> = {
  1: "Outside sending schedule",
  2: "Waiting for a lead",
  3: "Daily limit reached",
  4: "All sending accounts capped",
  99: "Sending error",
};

export interface CampaignAnalyticsSummary {
  emailsSent: number;
  contacted: number;
  opensUnique: number;
  openRate: number;
  repliesUnique: number;
  replyRate: number;
  bounced: number;
  bounceRate: number;
  unsubscribed: number;
  interested: number;
  meetingBooked: number;
  completed: number;
  opportunities: number;
  opportunityValue: number;
}

export interface CampaignRecord
  extends Omit<InstantlyCampaignSummary, "status"> {
  statusCode: CampaignStatusCode | number;
  status: string;
  defaultHook: string | null;
  analytics: CampaignAnalyticsSummary | null;
  sendingStatusLabel: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  scheduleStartDate: string | null;
  scheduleEndDate: string | null;
  scheduleNames: string[];
  scheduleTimezones: string[];
  isScheduled: boolean;
  hasTags: boolean;
  emailCount: number;
  senderCount: number;
}

export type CampaignPreset =
  | "all"
  | "active"
  | "drafts"
  | "paused"
  | "completed"
  | "running"
  | "evergreen"
  | "scheduled"
  | "blocked"
  | "tagged"
  | "untagged"
  | "with-hooks"
  | "without-hooks"
  | "high-performer"
  | "needs-attention";

export type CampaignSortKey =
  | "newest"
  | "updated"
  | "name-asc"
  | "name-desc"
  | "status"
  | "reply-rate"
  | "open-rate"
  | "bounce-rate"
  | "emails-sent"
  | "opportunity-value";

export function getCampaignStatusLabel(status?: number | null): string {
  if (typeof status !== "number") return "Unknown";
  return CAMPAIGN_STATUS_LABELS[status] ?? `Unknown (${status})`;
}

export function getCampaignSendingStatusLabel(status?: number | null): string | null {
  if (typeof status !== "number") return null;
  return CAMPAIGN_NOT_SENDING_STATUS_LABELS[status] ?? `Status ${status}`;
}

export function getCampaignCreatedAt(campaign: { timestamp_created?: string | null }): number {
  const value = campaign.timestamp_created || "";
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

export function getCampaignUpdatedAt(campaign: { timestamp_updated?: string | null }): number {
  const value = campaign.timestamp_updated || "";
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function normalizeText(value: unknown): string {
  if (typeof value === "string") return value.toLowerCase();
  if (typeof value === "number" || typeof value === "boolean") return String(value).toLowerCase();
  if (Array.isArray(value)) return value.map(normalizeText).join(" ");
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(normalizeText).join(" ");
  }
  return "";
}

export function campaignSearchText(campaign: CampaignRecord): string {
  return [
    campaign.name,
    campaign.status,
    campaign.sendingStatusLabel,
    campaign.defaultHook,
    campaign.organization,
    campaign.owned_by,
    campaign.ai_sdr_id,
    campaign.email_list?.join(" "),
    campaign.email_tag_list?.join(" "),
    campaign.scheduleNames.join(" "),
    campaign.scheduleTimezones.join(" "),
    campaign.custom_variables ? JSON.stringify(campaign.custom_variables) : "",
    campaign.core_variables ? JSON.stringify(campaign.core_variables) : "",
    campaign.analytics ? JSON.stringify(campaign.analytics) : "",
  ]
    .map(normalizeText)
    .join(" ");
}

export function isCampaignScheduled(campaign: {
  campaign_schedule?: InstantlyCampaignSummary["campaign_schedule"];
}): boolean {
  const schedule = campaign.campaign_schedule;
  if (!schedule) return false;
  if (schedule.start_date || schedule.end_date) return true;
  return (schedule.schedules || []).length > 0;
}

export function isCampaignBlocked(campaign: CampaignRecord): boolean {
  return (
    campaign.statusCode === -99 ||
    campaign.statusCode === -1 ||
    campaign.statusCode === -2 ||
    campaign.sendingStatusLabel !== null
  );
}

export function getCampaignPerformanceState(campaign: CampaignRecord): "needs-attention" | "high-performer" | null {
  const analytics = campaign.analytics;
  if (!analytics) return null;
  if (
    isCampaignBlocked(campaign) ||
    (campaign.statusCode === 1 &&
      (analytics.bounceRate >= 5 ||
        (analytics.emailsSent >= 50 && analytics.replyRate === 0 && analytics.openRate < 10)))
  ) {
    return "needs-attention";
  }
  if (
    analytics.meetingBooked > 0 ||
    analytics.opportunities > 0 ||
    analytics.replyRate >= 5 ||
    analytics.openRate >= 25
  ) {
    return "high-performer";
  }
  return null;
}

export function campaignMatchesPreset(
  campaign: CampaignRecord,
  preset: CampaignPreset
): boolean {
  switch (preset) {
    case "all":
      return true;
    case "active":
      return campaign.statusCode === 1 || campaign.statusCode === 4;
    case "drafts":
      return campaign.statusCode === 0;
    case "paused":
      return campaign.statusCode === 2;
    case "completed":
      return campaign.statusCode === 3;
    case "running":
      return campaign.statusCode === 4;
    case "evergreen":
      return Boolean(campaign.is_evergreen);
    case "scheduled":
      return campaign.isScheduled;
    case "blocked":
      return isCampaignBlocked(campaign);
    case "tagged":
      return campaign.hasTags;
    case "untagged":
      return !campaign.hasTags;
    case "with-hooks":
      return Boolean(campaign.defaultHook?.trim());
    case "without-hooks":
      return !campaign.defaultHook?.trim();
    case "high-performer":
      return getCampaignPerformanceState(campaign) === "high-performer";
    case "needs-attention":
      return getCampaignPerformanceState(campaign) === "needs-attention";
  }
  return false;
}

export function sortCampaigns(
  campaigns: CampaignRecord[],
  sortKey: CampaignSortKey
): CampaignRecord[] {
  const sorted = [...campaigns];
  const collator = new Intl.Collator(undefined, { sensitivity: "base" });

  const compareNumeric = (
    a: CampaignRecord,
    b: CampaignRecord,
    accessor: (campaign: CampaignRecord) => number
  ) => accessor(b) - accessor(a);

  sorted.sort((a, b) => {
    switch (sortKey) {
      case "updated":
        return getCampaignUpdatedAt(b) - getCampaignUpdatedAt(a);
      case "name-asc":
        return collator.compare(a.name, b.name);
      case "name-desc":
        return collator.compare(b.name, a.name);
      case "status":
        return (a.statusCode ?? 999) - (b.statusCode ?? 999) || collator.compare(a.name, b.name);
      case "reply-rate":
        return compareNumeric(a, b, (campaign) => campaign.analytics?.replyRate ?? -1);
      case "open-rate":
        return compareNumeric(a, b, (campaign) => campaign.analytics?.openRate ?? -1);
      case "bounce-rate":
        return compareNumeric(a, b, (campaign) => campaign.analytics?.bounceRate ?? -1);
      case "emails-sent":
        return compareNumeric(a, b, (campaign) => campaign.analytics?.emailsSent ?? -1);
      case "opportunity-value":
        return compareNumeric(a, b, (campaign) => campaign.analytics?.opportunityValue ?? -1);
      case "newest":
      default:
        return getCampaignCreatedAt(b) - getCampaignCreatedAt(a);
    }
  });

  return sorted;
}

export function mergeCampaignAnalytics(
  campaigns: InstantlyCampaignSummary[],
  analytics: InstantlyCampaignAnalyticsOverview[]
): CampaignRecord[] {
  const analyticsById = new Map(analytics.map((row) => [row.campaign_id, row]));

  return campaigns.map((campaign) => {
    const row = analyticsById.get(campaign.id);
    const schedule = campaign.campaign_schedule;
    const schedules = schedule?.schedules || [];
    const sendingStatusLabel = getCampaignSendingStatusLabel(campaign.not_sending_status);
    const analyticsSummary = row
      ? {
          emailsSent: row.emails_sent_count ?? 0,
          contacted: row.contacted_count ?? 0,
          opensUnique: row.open_count_unique ?? 0,
          openRate:
            row.contacted_count && row.contacted_count > 0
              ? Math.round(((row.open_count_unique ?? 0) / row.contacted_count) * 100)
              : 0,
          repliesUnique: row.reply_count_unique ?? 0,
          replyRate:
            row.contacted_count && row.contacted_count > 0
              ? Math.round(((row.reply_count_unique ?? 0) / row.contacted_count) * 100)
              : 0,
          bounced: row.bounced_count ?? 0,
          bounceRate:
            row.emails_sent_count && row.emails_sent_count > 0
              ? Math.round(((row.bounced_count ?? 0) / row.emails_sent_count) * 100)
              : 0,
          unsubscribed: row.unsubscribed_count ?? 0,
          interested: row.total_interested ?? 0,
          meetingBooked: row.total_meeting_booked ?? 0,
          completed: row.completed_count ?? 0,
          opportunities: row.total_opportunities ?? 0,
          opportunityValue: row.total_opportunity_value ?? 0,
        }
      : null;

    return {
      ...campaign,
      statusCode: campaign.status ?? -1,
      status: getCampaignStatusLabel(campaign.status),
      defaultHook: campaign.custom_variables?.default_hook ?? null,
      analytics: analyticsSummary,
      sendingStatusLabel,
      createdAt: campaign.timestamp_created ?? null,
      updatedAt: campaign.timestamp_updated ?? null,
      scheduleStartDate: schedule?.start_date ?? null,
      scheduleEndDate: schedule?.end_date ?? null,
      scheduleNames: schedules.map((entry) => entry.name).filter(Boolean) as string[],
      scheduleTimezones: schedules
        .map((entry) => entry.timezone)
        .filter(Boolean) as string[],
      isScheduled: isCampaignScheduled(campaign),
      hasTags: (campaign.email_tag_list?.length ?? 0) > 0,
      emailCount: campaign.email_list?.length ?? 0,
      senderCount: campaign.email_list?.length ?? 0,
    };
  });
}
