/**
 * Airtable CRUD helpers — raw fetch() against the Airtable REST API.
 *
 * The previous revision used the `airtable` npm package, which broke leads
 * loading on Vercel (likely an incompatibility with Next.js 14 server
 * components). This version uses raw fetch() — the same approach that was
 * working before commit 54e8f57.
 *
 * Auth: reads AIRTABLE_API_KEY first, falls back to AIRTABLE_PAT (the legacy
 * env var name used in the original Vercel deployment and README).
 *
 * Field-name mappings live in `lib/schema.ts` via `FIELD_NAME`.
 */

import {
  Lead,
  LeadUpdate,
  FIELD_NAME,
  Confidence,
  PersonalizationHookSource,
} from "./schema";

// ─── Config ─────────────────────────────────────────────────────────────────

const BASE_ID = process.env.AIRTABLE_BASE_ID ?? "appfS9ODVKZ2XEATW";
const LEADS_TABLE =
  process.env.AIRTABLE_LEADS_TABLE_ID ?? "tblfv5ljYNeAqz4WL";
const ARCHIVE_TABLE =
  process.env.AIRTABLE_ARCHIVE_TABLE_ID ?? "tblg1X65XmCpOYh7Q";

function airtableApiKey(): string | undefined {
  return process.env.AIRTABLE_API_KEY ?? process.env.AIRTABLE_PAT;
}

// ─── Raw fetch wrapper ──────────────────────────────────────────────────────

function endpoint(tableId: string): string {
  return `https://api.airtable.com/v0/${BASE_ID}/${tableId}`;
}

function authHeaders(): Record<string, string> {
  const key = airtableApiKey();
  if (!key) throw new Error("Airtable API key not set (AIRTABLE_API_KEY or AIRTABLE_PAT)");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

async function airtableFetch<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers as Record<string, string> ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

// ─── Record ↔ Lead mapping ──────────────────────────────────────────────────

function mapRecord(rec: AirtableRecord): Lead {
  const f = rec.fields;
  const get = <T>(key: string): T | undefined =>
    f[key] === undefined ? undefined : (f[key] as T);

  return {
    id: rec.id,

    // Identity
    name: get<string>(FIELD_NAME.name),
    email: get<string>(FIELD_NAME.email),
    firstName: get<string>(FIELD_NAME.firstName),
    lastName: get<string>(FIELD_NAME.lastName),
    title: get<string>(FIELD_NAME.title),
    linkedinUrl: get<string>(FIELD_NAME.linkedinUrl),

    // Company
    companyName: get<string>(FIELD_NAME.companyName),
    companyDomain: get<string>(FIELD_NAME.companyDomain),
    industry: get<string>(FIELD_NAME.industry),
    revenueBand: get<string>(FIELD_NAME.revenueBand),

    // Location
    city: get<string>(FIELD_NAME.city),
    state: get<string>(FIELD_NAME.state),

    // ICP / qualification
    icpFit: get<string>(FIELD_NAME.icpFit),
    decisionMakerRole: get<string>(FIELD_NAME.decisionMakerRole),
    disqualificationReason: get<string>(FIELD_NAME.disqualificationReason),

    // Sourcing
    source: get<string>(FIELD_NAME.source),
    sourceDetail: get<string>(FIELD_NAME.sourceDetail),
    sourceUrl: get<string>(FIELD_NAME.sourceUrl),
    sourceDate: get<string>(FIELD_NAME.sourceDate),

    // Pipeline
    pipelineStatus: get<string>(FIELD_NAME.pipelineStatus),

    // Personalization
    personalizationHook: get<string>(FIELD_NAME.personalizationHook),
    personalizationNotes: get<string>(FIELD_NAME.personalizationNotes),
    personalizationInsights: get<string>(FIELD_NAME.personalizationInsights),
    personalizationGeneratedAt: get<string>(
      FIELD_NAME.personalizationGeneratedAt
    ),
    insightsRefreshedAt: get<string>(FIELD_NAME.insightsRefreshedAt),
    personalizationConfidence: get<Confidence>(
      FIELD_NAME.personalizationConfidence
    ),
    personalizationReviewed: get<boolean>(FIELD_NAME.personalizationReviewed),
    personalizationHookSource: get<PersonalizationHookSource>(
      FIELD_NAME.personalizationHookSource
    ),
    personalizationAiCandidate: get<string>(
      FIELD_NAME.personalizationAiCandidate
    ),
    campaignDefaultHookSnapshot: get<string>(
      FIELD_NAME.campaignDefaultHookSnapshot
    ),

    // Instantly
    instantlyLeadId: get<string>(FIELD_NAME.instantlyLeadId),
    instantlyCampaignId: get<string>(FIELD_NAME.instantlyCampaignId),
    instantlyCampaignName: get<string>(FIELD_NAME.instantlyCampaignName),
    initialOutreachDate: get<string>(FIELD_NAME.initialOutreachDate),
    lastSyncedAt: get<string>(FIELD_NAME.lastSyncedAt),
    syncErrors: get<string>(FIELD_NAME.syncErrors),

    // Engagement
    emailsOpened: get<number>(FIELD_NAME.emailsOpened),
    lastOpenAt: get<string>(FIELD_NAME.lastOpenAt),
    replied: get<boolean>(FIELD_NAME.replied),
    lastReplyAt: get<string>(FIELD_NAME.lastReplyAt),
    replySentiment: get<string>(FIELD_NAME.replySentiment),
    meetingBooked: get<boolean>(FIELD_NAME.meetingBooked),
    bounced: get<boolean>(FIELD_NAME.bounced),
    unsubscribed: get<boolean>(FIELD_NAME.unsubscribed),

    // Archive
    archiveReason: get<string>(FIELD_NAME.archiveReason),
    reengagementCampaign: get<string>(FIELD_NAME.reengagementCampaign),

    // Misc
    notes: get<string>(FIELD_NAME.notes),
    createdAt: rec.createdTime,
    createdTime: rec.createdTime,
  };
}

// ─── Field builder (Lead → Airtable fields) ────────────────────────────────

type FieldSet = Record<string, unknown>;

function buildLeadFields(update: LeadUpdate): FieldSet {
  const out: FieldSet = {};
  const set = <K extends keyof LeadUpdate>(
    prop: K,
    fieldKey: keyof typeof FIELD_NAME
  ) => {
    if (update[prop] !== undefined) {
      out[FIELD_NAME[fieldKey]] = update[prop];
    }
  };

  set("name", "name");
  set("email", "email");
  set("firstName", "firstName");
  set("lastName", "lastName");
  set("title", "title");
  set("linkedinUrl", "linkedinUrl");
  set("companyName", "companyName");
  set("companyDomain", "companyDomain");
  set("industry", "industry");
  set("revenueBand", "revenueBand");
  set("city", "city");
  set("state", "state");
  set("icpFit", "icpFit");
  set("decisionMakerRole", "decisionMakerRole");
  set("disqualificationReason", "disqualificationReason");
  set("source", "source");
  set("sourceDetail", "sourceDetail");
  set("sourceUrl", "sourceUrl");
  set("sourceDate", "sourceDate");
  set("pipelineStatus", "pipelineStatus");
  set("personalizationHook", "personalizationHook");
  set("personalizationNotes", "personalizationNotes");
  set("personalizationInsights", "personalizationInsights");
  set("personalizationGeneratedAt", "personalizationGeneratedAt");
  set("insightsRefreshedAt", "insightsRefreshedAt");
  set("personalizationConfidence", "personalizationConfidence");
  set("personalizationReviewed", "personalizationReviewed");
  set("personalizationHookSource", "personalizationHookSource");
  set("personalizationAiCandidate", "personalizationAiCandidate");
  set("campaignDefaultHookSnapshot", "campaignDefaultHookSnapshot");
  set("instantlyLeadId", "instantlyLeadId");
  set("instantlyCampaignId", "instantlyCampaignId");
  set("instantlyCampaignName", "instantlyCampaignName");
  set("initialOutreachDate", "initialOutreachDate");
  set("lastSyncedAt", "lastSyncedAt");
  set("syncErrors", "syncErrors");
  set("emailsOpened", "emailsOpened");
  set("lastOpenAt", "lastOpenAt");
  set("replied", "replied");
  set("lastReplyAt", "lastReplyAt");
  set("replySentiment", "replySentiment");
  set("meetingBooked", "meetingBooked");
  set("bounced", "bounced");
  set("unsubscribed", "unsubscribed");
  set("notes", "notes");

  return out;
}

// ─── Generic paginated list ─────────────────────────────────────────────────

async function listFromTable(
  tableId: string,
  opts?: {
    filterByFormula?: string;
    sort?: { field: string; direction?: "asc" | "desc" }[];
    maxRecords?: number;
  }
): Promise<Lead[]> {
  const params = new URLSearchParams();
  params.set("pageSize", "100");
  if (opts?.maxRecords) params.set("maxRecords", String(opts.maxRecords));
  if (opts?.filterByFormula)
    params.set("filterByFormula", opts.filterByFormula);
  if (opts?.sort) {
    opts.sort.forEach((s, i) => {
      params.set(`sort[${i}][field]`, s.field);
      if (s.direction) params.set(`sort[${i}][direction]`, s.direction);
    });
  }

  const all: Lead[] = [];
  let offset: string | undefined;
  do {
    const sep = "?";
    const url = offset
      ? `${endpoint(tableId)}${sep}${params.toString()}&offset=${offset}`
      : `${endpoint(tableId)}${sep}${params.toString()}`;
    const data = await airtableFetch<AirtableListResponse>(url);
    for (const rec of data.records) all.push(mapRecord(rec));
    offset = data.offset;
  } while (offset);

  return all;
}

// ─── Leads: list / get / create / update / dedup / delete ───────────────────

export interface ListLeadsOptions {
  filterByFormula?: string;
  sort?: { field: string; direction?: "asc" | "desc" }[];
  maxRecords?: number;
  view?: string;
}

export async function listLeads(opts: ListLeadsOptions = {}): Promise<Lead[]> {
  if (!airtableApiKey()) {
    console.warn(
      "[airtable] Airtable API key not set (AIRTABLE_API_KEY / AIRTABLE_PAT) — listLeads returns []"
    );
    return [];
  }
  // Let errors propagate so callers can surface them (e.g. the ingestionError
  // banner on the homepage). The old code silently returned [] on all errors,
  // hiding misconfigurations from the operator.
  return listFromTable(LEADS_TABLE, opts);
}

export async function listInCampaignLeads(): Promise<Lead[]> {
  return listLeads({
    filterByFormula: `{${FIELD_NAME.pipelineStatus}} = 'In Campaign'`,
    sort: [{ field: FIELD_NAME.initialOutreachDate, direction: "desc" }],
  });
}

export async function listArchiveLeads(): Promise<Lead[]> {
  if (!airtableApiKey() || !ARCHIVE_TABLE) return [];
  try {
    return await listFromTable(ARCHIVE_TABLE);
  } catch (err) {
    console.error("[airtable] listArchiveLeads error:", err);
    return [];
  }
}

export async function getLead(id: string): Promise<Lead | null> {
  try {
    const rec = await airtableFetch<AirtableRecord>(
      `${endpoint(LEADS_TABLE)}/${id}`
    );
    return mapRecord(rec);
  } catch (err) {
    console.error("[airtable] getLead error:", err);
    return null;
  }
}

export async function getLeads(ids: string[]): Promise<Lead[]> {
  if (!ids.length) return [];
  const formula =
    ids.length === 1
      ? `RECORD_ID() = '${ids[0]}'`
      : `OR(${ids.map((id) => `RECORD_ID() = '${id}'`).join(",")})`;
  return listFromTable(LEADS_TABLE, { filterByFormula: formula });
}

export async function findLeadByEmailOrDomain(
  email?: string,
  companyDomain?: string
): Promise<Lead | null> {
  const conditions: string[] = [];
  if (email)
    conditions.push(
      `{${FIELD_NAME.email}} = '${email.replace(/'/g, "''")}'`
    );
  if (companyDomain)
    conditions.push(
      `{${FIELD_NAME.companyDomain}} = '${companyDomain.replace(/'/g, "''")}'`
    );
  if (!conditions.length) return null;

  const formula =
    conditions.length === 1 ? conditions[0] : `OR(${conditions.join(",")})`;

  const results = await listFromTable(LEADS_TABLE, {
    filterByFormula: formula,
    maxRecords: 1,
  });
  return results.length ? results[0] : null;
}

export async function createLead(data: LeadUpdate): Promise<Lead> {
  const fields = buildLeadFields(data);
  const result = await airtableFetch<{ id: string; createdTime: string; fields: Record<string, unknown> }>(
    endpoint(LEADS_TABLE),
    {
      method: "POST",
      body: JSON.stringify({ fields }),
    }
  );
  return mapRecord(result);
}

export async function updateLead(
  id: string,
  update: LeadUpdate
): Promise<Lead> {
  const fields = buildLeadFields(update);
  const result = await airtableFetch<AirtableRecord>(
    `${endpoint(LEADS_TABLE)}/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ fields }),
    }
  );
  return mapRecord(result);
}

export async function deleteLead(id: string): Promise<void> {
  await airtableFetch(`${endpoint(LEADS_TABLE)}/${id}`, {
    method: "DELETE",
  });
}

// ─── Leads → Re-engagement Archive movement ────────────────────────────────

export async function moveToArchive(
  lead: Lead,
  archiveReason: string
): Promise<void> {
  if (!ARCHIVE_TABLE)
    throw new Error("AIRTABLE_ARCHIVE_TABLE_ID is not set");
  const fields = buildArchiveFields(lead);
  fields[FIELD_NAME.archiveReason] = archiveReason;
  await airtableFetch(endpoint(ARCHIVE_TABLE), {
    method: "POST",
    body: JSON.stringify({ fields }),
  });
  try {
    await airtableFetch(`${endpoint(LEADS_TABLE)}/${lead.id}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.warn(
      `[airtable] moveToArchive: created in Archive but failed to delete Lead ${lead.id}:`,
      err
    );
  }
}

function buildArchiveFields(lead: Lead): FieldSet {
  const out: FieldSet = {};
  const set = <K extends keyof Lead>(prop: K, fieldKey: keyof typeof FIELD_NAME) => {
    if (lead[prop] !== undefined) out[FIELD_NAME[fieldKey]] = lead[prop];
  };

  set("name", "name");
  set("firstName", "firstName");
  set("lastName", "lastName");
  set("email", "email");
  set("title", "title");
  set("linkedinUrl", "linkedinUrl");
  set("companyName", "companyName");
  set("companyDomain", "companyDomain");
  set("city", "city");
  set("state", "state");
  set("industry", "industry");
  set("revenueBand", "revenueBand");
  set("icpFit", "icpFit");
  set("decisionMakerRole", "decisionMakerRole");
  set("source", "source");
  set("sourceDetail", "sourceDetail");
  set("sourceUrl", "sourceUrl");
  set("personalizationHook", "personalizationHook");
  set("personalizationInsights", "personalizationInsights");
  set("instantlyLeadId", "instantlyLeadId");
  set("instantlyCampaignId", "instantlyCampaignId");
  set("instantlyCampaignName", "instantlyCampaignName");
  set("replied", "replied");
  set("replySentiment", "replySentiment");
  set("meetingBooked", "meetingBooked");
  set("bounced", "bounced");
  set("unsubscribed", "unsubscribed");
  set("reengagementCampaign", "reengagementCampaign");
  set("notes", "notes");

  return out;
}
