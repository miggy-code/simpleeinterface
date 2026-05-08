import { listInCampaignLeads, updateLead } from "../airtable";
import { getInstantlyLead } from "../instantly";

export interface EngagementSyncOptions {
  batchSize?: number;
  batchDelayMs?: number;
  capErrorDetails?: number;
}

export interface EngagementSyncSummary {
  total: number;
  withInstantly: number;
  synced: number;
  skipped: number;
  errors: string[];
  cappedErrorDetails: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runEngagementSync(
  opts: EngagementSyncOptions = {}
): Promise<EngagementSyncSummary> {
  const batchSize = Math.max(1, opts.batchSize ?? 1);
  const batchDelayMs = Math.max(0, opts.batchDelayMs ?? 0);
  const capErrorDetails = Math.max(0, opts.capErrorDetails ?? 10);

  const leads = await listInCampaignLeads();
  const withInstantly = leads.filter((lead) => !!lead.instantlyLeadId);

  let synced = 0;
  const errors: string[] = [];

  for (let i = 0; i < withInstantly.length; i += batchSize) {
    const batch = withInstantly.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (lead) => {
        try {
          const instantlyLead = await getInstantlyLead(lead.instantlyLeadId!);
          await updateLead(lead.id, {
            emailsOpened:
              instantlyLead.email_open_count ??
              instantlyLead.email_opened_count ??
              0,
            lastOpenAt: instantlyLead.timestamp_last_open,
            replied: (instantlyLead.email_reply_count ?? 0) > 0,
            lastReplyAt: instantlyLead.timestamp_last_reply,
            bounced: instantlyLead.esp_code === 2,
            unsubscribed: instantlyLead.is_unsubscribed || false,
            lastSyncedAt: new Date().toISOString(),
            syncErrors: "",
          });
          synced++;
        } catch (err) {
          const msg = `${lead.email}: ${
            err instanceof Error ? err.message : String(err)
          }`;
          errors.push(msg);
          try {
            await updateLead(lead.id, { syncErrors: msg });
          } catch {
            // ignore secondary persistence failures
          }
        }
      })
    );

    if (batchDelayMs > 0 && i + batchSize < withInstantly.length) {
      await sleep(batchDelayMs);
    }
  }

  return {
    total: leads.length,
    withInstantly: withInstantly.length,
    synced,
    skipped: leads.length - withInstantly.length,
    errors,
    cappedErrorDetails: errors.slice(0, capErrorDetails),
  };
}
