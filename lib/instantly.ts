/**
 * Instantly v2 API client.
 *
 * Docs: https://developer.instantly.ai/
 * Auth: Bearer <api-key>
 *
 * Instantly is the source of truth for campaign metadata, sequences, and
 * the per-campaign `default_hook` (stored in `campaign.custom_variables`).
 * This client wraps every endpoint the rest of the app touches.
 */

const BASE = "https://api.instantly.ai/api/v2";
const KEY = process.env.INSTANTLY_API_KEY;

if (!KEY) console.warn("[instantly] INSTANTLY_API_KEY is not set");

async function instantlyFetch<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Instantly ${res.status} on ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Lead types & helpers ────────────────────────────────────────────────────

export interface InstantlyLead {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  campaign?: string;
  personalization?: string;
  payload?: Record<string, string | number | boolean | null>;
  status?: number;
  email_opened_count?: number;
  email_open_count?: number;
  email_reply_count?: number;
  email_clicked_count?: number;
  custom_variables?: Record<string, string | number | boolean | null>;
  timestamp_created?: string;
  timestamp_updated?: string;
  timestamp_last_contact?: string;
  timestamp_last_open?: string;
  timestamp_last_reply?: string;
  esp_code?: number;
  is_unsubscribed?: boolean;
}

/**
 * Create a lead in a campaign with personalization variables.
 */
export async function createInstantlyLead(input: {
  campaign: string;
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  website?: string;
  company_domain?: string;
  /** for the `{{personalization_hook}}` merge tag */
  personalization?: string;
  custom_variables?: Record<string, string | number | boolean | null>;
}): Promise<InstantlyLead> {
  const body: Record<string, unknown> = {
    campaign: input.campaign,
    email: input.email,
    first_name: input.first_name,
    last_name: input.last_name,
    company_name: input.company_name,
    website: input.website,
    company_domain: input.company_domain,
    custom_variables: {
      ...(input.personalization
        ? { personalization_hook: input.personalization }
        : {}),
      ...(input.custom_variables || {}),
    },
  };
  return instantlyFetch<InstantlyLead>("/leads", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getInstantlyLead(id: string): Promise<InstantlyLead> {
  return instantlyFetch<InstantlyLead>(`/leads/${id}`);
}

interface ListLeadsResponse {
  items?: InstantlyLead[];
  next_starting_after?: string | null;
}

/** List leads, paginated, optionally scoped to a campaign. */
export async function listInstantlyLeads(opts?: {
  campaign?: string;
  contacts?: string[];
  limit?: number;
}): Promise<InstantlyLead[]> {
  const all: InstantlyLead[] = [];
  let starting_after: string | undefined;
  do {
    const body: Record<string, unknown> = { limit: opts?.limit ?? 100 };
    if (opts?.campaign) body.campaign = opts.campaign;
    if (opts?.contacts?.length) body.contacts = opts.contacts;
    if (starting_after) body.starting_after = starting_after;
    const data = await instantlyFetch<ListLeadsResponse>("/leads/list", {
      method: "POST",
      body: JSON.stringify(body),
    });
    for (const l of data.items || []) all.push(l);
    starting_after = data.next_starting_after || undefined;
  } while (starting_after && all.length < (opts?.limit ?? 1000));
  return all;
}

export interface InstantlyAccount {
  email: string;
  status?: number;
  first_name?: string;
  last_name?: string;
  daily_limit?: number;
  timestamp_created?: string;
  timestamp_updated?: string;
}

interface ListAccountsResponse {
  items?: InstantlyAccount[];
  next_starting_after?: string | null;
}

export async function listInstantlyAccounts(opts?: {
  limit?: number;
  search?: string;
  status?: number;
  starting_after?: string;
}): Promise<InstantlyAccount[]> {
  const all: InstantlyAccount[] = [];
  let starting_after = opts?.starting_after;
  do {
    const params = new URLSearchParams({ limit: String(opts?.limit ?? 100) });
    if (opts?.search) params.set("search", opts.search);
    if (typeof opts?.status === "number") params.set("status", String(opts.status));
    if (starting_after) params.set("starting_after", starting_after);
    const data = await instantlyFetch<ListAccountsResponse>(
      `/accounts?${params.toString()}`
    );
    for (const account of data.items || []) all.push(account);
    starting_after = data.next_starting_after || undefined;
  } while (starting_after);
  return all;
}

// ─── Campaign types & helpers ────────────────────────────────────────────────

export interface InstantlyCampaignSummary {
  id: string;
  name: string;
  status?: number;
  timestamp_created?: string;
  timestamp_updated?: string;
  is_evergreen?: boolean;
  campaign_schedule?: {
    start_date?: string | null;
    end_date?: string | null;
    schedules?: Array<{
      name?: string;
      timing?: { from?: string; to?: string };
      days?: Record<string, boolean>;
      timezone?: string;
    }>;
  };
  daily_limit?: number | null;
  daily_max_leads?: number | null;
  email_gap?: number | null;
  random_wait_max?: number | null;
  text_only?: boolean | null;
  first_email_text_only?: boolean | null;
  email_list?: string[];
  email_tag_list?: string[];
  cc_list?: string[];
  bcc_list?: string[];
  open_tracking?: boolean | null;
  link_tracking?: boolean | null;
  stop_on_reply?: boolean | null;
  stop_on_auto_reply?: boolean | null;
  prioritize_new_leads?: boolean | null;
  match_lead_esp?: boolean | null;
  not_sending_status?: number | null;
  stop_for_company?: boolean | null;
  insert_unsubscribe_header?: boolean | null;
  allow_risky_contacts?: boolean | null;
  disable_bounce_protect?: boolean | null;
  organization?: string | null;
  owned_by?: string | null;
  ai_sdr_id?: string | null;
  provider_routing_rules?: Array<{
    action?: string;
    recipient_esp?: string[];
    sender_esp?: string[];
  }>;
  custom_variables?: Record<string, string>;
  core_variables?: Record<string, unknown>;
  pl_value?: number | null;
}

interface ListCampaignsResponse {
  items?: InstantlyCampaignSummary[];
  next_starting_after?: string | null;
}

export interface InstantlyCampaignAnalyticsOverview {
  campaign_id: string;
  campaign_name: string;
  campaign_status?: number;
  campaign_is_evergreen?: boolean;
  leads_count?: number;
  contacted_count?: number;
  emails_sent_count?: number;
  new_leads_contacted_count?: number;
  open_count?: number;
  reply_count?: number;
  link_click_count?: number;
  bounced_count?: number;
  unsubscribed_count?: number;
  completed_count?: number;
  total_opportunities?: number;
  total_opportunity_value?: number;
  open_count_unique?: number;
  open_count_unique_by_step?: number;
  reply_count_unique?: number;
  reply_count_unique_by_step?: number;
  reply_count_automatic?: number;
  reply_count_automatic_unique?: number;
  reply_count_automatic_unique_by_step?: number;
  link_click_count_unique?: number;
  link_click_count_unique_by_step?: number;
  total_interested?: number;
  total_meeting_booked?: number;
  total_meeting_completed?: number;
  total_closed?: number;
}

export interface InstantlyCampaignSequenceVariant {
  subject?: string;
  body?: string;
}

export interface InstantlyCampaignSequenceStep {
  type?: string;
  delay?: number;
  variants?: InstantlyCampaignSequenceVariant[];
}

export interface InstantlyCampaignSequence {
  steps?: InstantlyCampaignSequenceStep[];
}

export interface InstantlyCampaignFull extends InstantlyCampaignSummary {
  sequences?: InstantlyCampaignSequence[];
}

/**
 * List ALL Instantly campaigns including drafts. The list endpoint does not
 * filter by status — campaigns land as Draft (status 0) on creation and are
 * activated by the operator in Instantly's UI.
 */
export async function listInstantlyCampaigns(): Promise<
  InstantlyCampaignSummary[]
> {
  const all: InstantlyCampaignSummary[] = [];
  let starting_after: string | undefined;
  do {
    const params = new URLSearchParams({ limit: "100" });
    if (starting_after) params.set("starting_after", starting_after);
    const data = await instantlyFetch<ListCampaignsResponse>(
      `/campaigns?${params.toString()}`
    );
    for (const c of data.items || []) all.push(c);
    starting_after = data.next_starting_after || undefined;
  } while (starting_after);
  return all;
}

export async function listInstantlyCampaignAnalytics(): Promise<
  InstantlyCampaignAnalyticsOverview[]
> {
  return instantlyFetch<InstantlyCampaignAnalyticsOverview[]>(
    "/campaigns/analytics"
  );
}

/** Fetch a single campaign with full detail (sequences, custom_variables). */
export async function getInstantlyCampaign(
  campaignId: string
): Promise<InstantlyCampaignFull> {
  return instantlyFetch<InstantlyCampaignFull>(`/campaigns/${campaignId}`);
}

/**
 * Create a new Instantly campaign. Lands as Draft (status 0) until the
 * operator activates it in Instantly's UI.
 */
export async function createInstantlyCampaign(input: {
  name: string;
  custom_variables?: Record<string, string>;
  campaign_schedule: {
    schedules: Array<{
      name: string;
      timing: { from: string; to: string };
      days: Record<string, boolean>;
      timezone: string;
    }>;
    start_date?: string | null;
    end_date?: string | null;
  };
  email_list: string[];
  sequences: InstantlyCampaignSequence[];
}): Promise<{ id: string; name: string; status: number }> {
  const body: Record<string, unknown> = {
    name: input.name,
    campaign_schedule: input.campaign_schedule,
    email_list: input.email_list,
    sequences: input.sequences,
  };
  if (input.custom_variables) body.custom_variables = input.custom_variables;
  const created = await instantlyFetch<{
    id: string;
    name: string;
    status: number;
  }>("/campaigns", {
    method: "POST",
    body: JSON.stringify(body),
  });
  console.info(
    `[instantly] campaign created: id=${created.id} status=${created.status} name="${created.name}"`
  );
  return created;
}

/**
 * Add an email step to a campaign's sequence. We always append to the first
 * sequence (Instantly campaigns have one sequence by default).
 */
export async function addInstantlyEmail(
  campaignId: string,
  step: {
    subject: string;
    body: string;
    senderEmail: string;
    senderName?: string;
    delay?: number;
  }
): Promise<unknown> {
  // Fetch current campaign to get existing sequences (PATCH is full replacement).
  const current = await getInstantlyCampaign(campaignId);
  const sequences = current.sequences ?? [];
  const firstSeq = sequences[0] ?? { steps: [] };
  const existingSteps = firstSeq.steps ?? [];

  const newStep: InstantlyCampaignSequenceStep = {
    type: "email",
    delay: step.delay ?? (existingSteps.length === 0 ? 0 : 3),
    variants: [
      {
        subject: step.subject,
        body: step.body,
      },
    ],
  };

  const updatedSequences: InstantlyCampaignSequence[] = [
    {
      ...firstSeq,
      steps: [...existingSteps, newStep],
    },
    ...sequences.slice(1),
  ];

  return instantlyFetch(`/campaigns/${campaignId}`, {
    method: "PATCH",
    body: JSON.stringify({ sequences: updatedSequences }),
  });
}

/**
 * Set an entire sequence in one shot. Used by the wizard to write the
 * final, edited 3-email sequence atomically.
 */
export async function setInstantlyCampaignSequence(
  campaignId: string,
  emails: Array<{ subject: string; body: string }>,
  opts?: { delays?: number[] } // defaults to [0, 3, 7]
): Promise<unknown> {
  const delays = opts?.delays ?? [0, 3, 7, 14];
  const steps: InstantlyCampaignSequenceStep[] = emails.map((e, i) => ({
    type: "email",
    delay: delays[i] ?? delays[delays.length - 1],
    variants: [{ subject: e.subject, body: e.body }],
  }));

  return instantlyFetch(`/campaigns/${campaignId}`, {
    method: "PATCH",
    body: JSON.stringify({ sequences: [{ steps }] }),
  });
}

/**
 * Set or update campaign-level `custom_variables`. PATCH-merge semantics:
 * the supplied keys are MERGED with existing variables (Instantly's PATCH
 * preserves keys we don't include).
 */
export async function setInstantlyCampaignCustomVariables(
  campaignId: string,
  vars: Record<string, string>
): Promise<unknown> {
  // Fetch to get existing custom_variables, then merge before write.
  const current = await getInstantlyCampaign(campaignId);
  const merged = { ...(current.custom_variables ?? {}), ...vars };
  console.info(
    `[instantly] setting custom_variables for ${campaignId}: keys=[${Object.keys(
      vars
    ).join(",")}]`
  );
  return instantlyFetch(`/campaigns/${campaignId}`, {
    method: "PATCH",
    body: JSON.stringify({ custom_variables: merged }),
  });
}
