/**
 * Central type definitions for the application.
 *
 * Airtable column names are mapped to camelCase TS properties via the
 * `FIELD_NAME` constant below. Keep that map in sync with the live
 * Airtable schema (docs/Data_Flow_and_Schema_Map.md is the canonical
 * reference; check there before adding/renaming fields).
 */

// ─── FIELD_NAME ──────────────────────────────────────────────────────────────
// Single source of truth for Airtable column names. Use this constant in
// `filterByFormula` strings, `sort` specs, and field-existence checks so a
// rename only has to happen here.

export const FIELD_NAME = {
  // Identity
  name: "Name",
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  title: "Title",
  linkedinUrl: "LinkedIn URL",

  // Company
  companyName: "Company Name",
  companyDomain: "Company Domain",
  industry: "Industry",
  revenueBand: "Revenue Band",

  // Location
  city: "City",
  state: "State",

  // ICP / qualification
  icpFit: "ICP Fit",
  decisionMakerRole: "Decision Maker Role",
  disqualificationReason: "Disqualification Reason",

  // Sourcing
  source: "Source",
  sourceDetail: "Source Detail",
  sourceUrl: "Source URL",
  sourceDate: "Source Date",

  // Pipeline
  pipelineStatus: "Pipeline Status",

  // Personalization
  personalizationHook: "Personalization Hook",
  personalizationNotes: "Personalization Notes",
  personalizationInsights: "Personalization Insights",
  personalizationGeneratedAt: "Personalization Generated At",
  insightsRefreshedAt: "Insights Refreshed At",
  personalizationConfidence: "Personalization Confidence",
  personalizationReviewed: "Personalization Reviewed",
  personalizationHookSource: "Personalization Hook Source",
  personalizationAiCandidate: "Personalization AI Candidate",
  campaignDefaultHookSnapshot: "Campaign Default Hook Snapshot",

  // Instantly
  instantlyLeadId: "Instantly Lead ID",
  instantlyCampaignId: "Instantly Campaign ID",
  instantlyCampaignName: "Instantly Campaign Name",
  initialOutreachDate: "Initial Outreach Date",
  lastSyncedAt: "Last Synced At",
  syncErrors: "Sync Errors",

  // Engagement
  emailsOpened: "Emails Opened",
  lastOpenAt: "Last Open At",
  replied: "Replied",
  lastReplyAt: "Last Reply At",
  replySentiment: "Reply Sentiment",
  meetingBooked: "Meeting Booked",
  bounced: "Bounced",
  unsubscribed: "Unsubscribed",

  // Archive-only (only present on Re-engagement Archive table)
  archiveReason: "Archive Reason",
  reengagementCampaign: "Re-engagement Campaign",

  // Misc
  notes: "Notes",
} as const;

export type FieldKey = keyof typeof FIELD_NAME;

// ─── Pipeline-status state machine + enums ───────────────────────────────────

export const PIPELINE_STATUSES = [
  "New",
  "Researching",
  "Ready to Personalize",
  "Personalized",
  "Approved",
  "In Campaign",
  "Engaged",
  "Interested",
  "Meeting Booked",
  "Not Interested",
  "Bounced",
  "Unsubscribed",
  "Disqualified",
] as const;
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

/** Statuses that prevent further automated action (used by PipelineTable's bucketing). */
export const TERMINAL_STATUSES: readonly string[] = [
  "Bounced",
  "Unsubscribed",
  "Disqualified",
  "Not Interested",
  "Meeting Booked",
];

/** Tailwind class strings for the status pill, keyed by pipeline status. */
export const STATUS_TONE: Record<string, string> = {
  New: "bg-ink-100 text-ink-600 border-ink-200",
  Researching: "bg-ink-100 text-ink-700 border-ink-200",
  "Ready to Personalize": "bg-blue-50 text-blue-700 border-blue-200",
  Personalized: "bg-violet-50 text-violet-700 border-violet-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "In Campaign": "bg-amber-50 text-amber-800 border-amber-200",
  Engaged: "bg-amber-100 text-amber-900 border-amber-300",
  Interested: "bg-emerald-100 text-emerald-800 border-emerald-300",
  "Meeting Booked":
    "bg-emerald-100 text-emerald-900 border-emerald-400 font-semibold",
  "Not Interested": "bg-ink-100 text-ink-500 border-ink-200",
  Bounced: "bg-red-50 text-red-700 border-red-200",
  Unsubscribed: "bg-red-50 text-red-700 border-red-200",
  Disqualified: "bg-ink-200 text-ink-500 border-ink-300",
};

export const ICP_FITS = ["A", "B", "C", "Disqualified", "Unscored"] as const;
/** @deprecated alias — use `ICP_FITS`. */
export const ICP_FIT_VALUES = ICP_FITS;
export type IcpFit = (typeof ICP_FITS)[number];

export const REVENUE_BANDS = [
  "<$5M",
  "$5M-$10M",
  "$10M-$25M",
  "$25M-$50M",
  "$50M-$100M",
  "$100M+",
  "Unknown",
] as const;
export type RevenueBand = (typeof REVENUE_BANDS)[number];

export const DECISION_MAKER_ROLES = [
  "Owner",
  "CEO",
  "COO",
  "President",
  "Founder",
  "Other",
] as const;
export type DecisionMakerRole = (typeof DECISION_MAKER_ROLES)[number];

export const LEAD_SOURCES = [
  "AI Prospecting",
  "Manual",
  "Referral",
  "Inbound",
  "Event",
  "Other",
] as const;
/** @deprecated alias — use `LEAD_SOURCES`. */
export const SOURCES = LEAD_SOURCES;
export type Source = (typeof LEAD_SOURCES)[number];

// ─── Re-engagement Archive reasons ───────────────────────────────────────────

export const ARCHIVE_REASONS = [
  "21-day sequence complete",
  "Terminal: Bounced",
  "Terminal: Unsubscribed",
  "Terminal: Not Interested",
  "Manual archive",
] as const;
export type ArchiveReason = (typeof ARCHIVE_REASONS)[number];

export const REPLY_SENTIMENTS = [
  "Interested",
  "Neutral",
  "Not Interested",
  "Unclassified",
] as const;
export type ReplySentiment = (typeof REPLY_SENTIMENTS)[number];

export const CONFIDENCES = ["High", "Medium", "Low"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const PERSONALIZATION_HOOK_SOURCES = [
  "AI Specific",
  "Campaign Default",
  "Manual Edit",
  "Reverted Default",
] as const;
export type PersonalizationHookSource =
  (typeof PERSONALIZATION_HOOK_SOURCES)[number];

export const INDUSTRIES = [
  "Manufacturing",
  "Distribution",
  "Logistics",
  "Food Production",
  "Facilities",
  "Equipment",
  "Industrial Services",
  "Other",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

// ─── Lead ────────────────────────────────────────────────────────────────────
//
// A single Lead type covers rows from Leads and Re-engagement Archive. Fields
// that only exist on a subset of those tables are still optional here — they're
// undefined when missing.

export interface Lead {
  /** Airtable record ID */
  id: string;

  // Identity
  /** Primary field — typically `${firstName} ${lastName}`. */
  name?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  linkedinUrl?: string;

  // Company
  companyName?: string;
  companyDomain?: string;
  industry?: Industry | string;
  revenueBand?: RevenueBand | string;

  // Location
  city?: string;
  state?: string;

  // ICP / qualification
  icpFit?: IcpFit | string;
  decisionMakerRole?: DecisionMakerRole | string;
  disqualificationReason?: string;

  // Sourcing
  source?: Source | string;
  sourceDetail?: string;
  sourceUrl?: string;
  sourceDate?: string;

  // Pipeline
  pipelineStatus?: PipelineStatus | string;

  // Personalization
  personalizationHook?: string;
  personalizationNotes?: string;
  /**
   * The canonical input for hook generation — bullet list of factoids
   * populated by the upstream sourcing agent. See
   * `docs/Agent_Lead_Sourcing_Instructions.md`.
   */
  personalizationInsights?: string;
  personalizationGeneratedAt?: string;
  insightsRefreshedAt?: string;
  personalizationConfidence?: Confidence;
  personalizationReviewed?: boolean;
  personalizationHookSource?: PersonalizationHookSource | string;
  personalizationAiCandidate?: string;
  campaignDefaultHookSnapshot?: string;

  // Instantly
  instantlyLeadId?: string;
  instantlyCampaignId?: string;
  instantlyCampaignName?: string;
  initialOutreachDate?: string;
  lastSyncedAt?: string;
  syncErrors?: string;

  // Engagement
  emailsOpened?: number;
  lastOpenAt?: string;
  replied?: boolean;
  lastReplyAt?: string;
  replySentiment?: ReplySentiment | string;
  meetingBooked?: boolean;
  bounced?: boolean;
  unsubscribed?: boolean;

  // Archive-only (only present on rows from Re-engagement Archive)
  archiveReason?: string;
  reengagementCampaign?: string;

  // Misc
  notes?: string;
  createdAt?: string;
  /** Alias of `createdAt` populated from Airtable's `createdTime`. */
  createdTime?: string;

  // ─── Legacy / aspirational (NOT in Airtable; always undefined) ────────────
  // Kept here so existing call sites compile during the migration. Will be
  // removed once `lib/prompts.ts` and other consumers no longer reference them.
  /** @deprecated — not in Airtable. Use `personalizationInsights` instead. */
  recentNews?: string;
  /** @deprecated — not in Airtable. Use `personalizationInsights` instead. */
  jobPostings?: string;
  /** @deprecated — not in Airtable. Use `personalizationInsights` instead. */
  techStack?: string;
  /** @deprecated — not in Airtable. Use `personalizationInsights` instead. */
  leadershipChanges?: string;
  /** @deprecated — not in Airtable. Use `personalizationInsights` instead. */
  awards?: string;
  /** @deprecated — not in Airtable. Use `personalizationInsights` instead. */
  socialPosts?: string;
  /** @deprecated — not in Airtable. Use `personalizationInsights` instead. */
  websiteSummary?: string;
  /** @deprecated — not in Airtable. */
  companySize?: string;
  /** @deprecated — not in Airtable. */
  companyLinkedinUrl?: string;
  /** @deprecated — not in Airtable. Use `city` + `state`. */
  location?: string;
  /** @deprecated — derive from `pipelineStatus === "In Campaign"` instead. */
  pushed?: boolean;
  /** @deprecated — not in Airtable. */
  enriched?: boolean;
}

export type LeadUpdate = Partial<Omit<Lead, "id">>;

// ─── AI outputs ──────────────────────────────────────────────────────────────

/**
 * Shape returned by `generateHook()` in `lib/ai.ts`.
 */
export interface HookGenerationResult {
  /** Hook text, or null when no specific signal was found. */
  hook: string | null;
  /** Confidence in the hook's specificity. */
  confidence: Confidence;
  /** AI's one-sentence explanation. */
  reasoning?: string;
}

export interface CampaignEmailStepContext {
  stepNumber: number;
  subject: string;
  body: string;
}

export interface CampaignHookContext {
  campaignId: string;
  campaignName?: string;
  defaultHook?: string | null;
  steps: CampaignEmailStepContext[];
}
