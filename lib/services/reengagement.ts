import { listInCampaignLeads, moveToArchive, updateLead } from "../airtable";
import { ArchiveReason, Lead } from "../schema";

export interface ReengagementOptions {
  reengagementDays?: number;
  includeMovedLeads?: boolean;
  annotateLeadErrors?: boolean;
}

export interface ReengagementSummary {
  checked: number;
  moved: number;
  errors: string[];
  movedLeads: string[];
}

function daysSince(value: string): number | null {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
}

function resolveArchiveReason(
  lead: Lead,
  reengagementDays: number
): ArchiveReason | null {
  if (lead.bounced) return "Terminal: Bounced";
  if (lead.unsubscribed) return "Terminal: Unsubscribed";
  if (lead.replied && lead.replySentiment === "Not Interested") {
    return "Terminal: Not Interested";
  }
  if (!lead.initialOutreachDate) return null;

  const elapsed = daysSince(lead.initialOutreachDate);
  if (elapsed !== null && elapsed >= reengagementDays) {
    return "21-day sequence complete";
  }
  return null;
}

export async function runReengagementJob(
  opts: ReengagementOptions = {}
): Promise<ReengagementSummary> {
  const reengagementDays = Math.max(1, opts.reengagementDays ?? 21);
  const includeMovedLeads = opts.includeMovedLeads ?? false;
  const annotateLeadErrors = opts.annotateLeadErrors ?? true;

  const leads = await listInCampaignLeads();
  const errors: string[] = [];
  const movedLeads: string[] = [];
  let moved = 0;

  for (const lead of leads) {
    try {
      if (lead.meetingBooked || lead.replySentiment === "Interested") {
        continue;
      }

      const archiveReason = resolveArchiveReason(lead, reengagementDays);
      if (!archiveReason) {
        if (!lead.initialOutreachDate) {
          await updateLead(lead.id, {
            syncErrors:
              "Missing Initial Outreach Date; re-engagement check skipped",
          });
        }
        continue;
      }

      await moveToArchive(lead, archiveReason);
      moved++;
      if (includeMovedLeads) {
        movedLeads.push(`${lead.name || lead.email || lead.id} → ${archiveReason}`);
      }
    } catch (err) {
      const msg = `Lead ${lead.id} (${lead.email}): ${
        err instanceof Error ? err.message : String(err)
      }`;
      errors.push(msg);

      if (annotateLeadErrors) {
        try {
          await updateLead(lead.id, {
            syncErrors: `Re-engagement error ${new Date().toISOString()}: ${msg}`,
          });
        } catch {
          // ignore secondary persistence failures
        }
      }
    }
  }

  return {
    checked: leads.length,
    moved,
    errors,
    movedLeads,
  };
}
