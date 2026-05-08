/**
 * GET /api/campaigns/analytics
 *
 * Fetches analytics for all active Instantly campaigns and returns them
 * grouped by campaign ID, ready for the In Campaign performance panel.
 *
 * Query params:
 *   ?campaignIds=id1,id2,id3   (optional, comma-separated)
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;
const BASE = "https://api.instantly.ai/api/v2";

interface CampaignAnalytics {
  campaignId: string;
  campaignName: string;
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
}

async function fetchCampaignList(): Promise<{ id: string; name: string }[]> {
  const res = await fetch(`${BASE}/campaigns?limit=50&status=1`, {
    headers: { Authorization: `Bearer ${INSTANTLY_API_KEY}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || data || []).map((c: { id: string; name: string }) => ({
    id: c.id,
    name: c.name,
  }));
}

async function fetchCampaignAnalytics(
  campaignId: string,
  campaignName: string
): Promise<CampaignAnalytics> {
  const res = await fetch(
    `${BASE}/analytics/campaign/overview?campaign_id=${campaignId}`,
    {
      headers: { Authorization: `Bearer ${INSTANTLY_API_KEY}` },
    }
  );

  if (!res.ok) {
    return {
      campaignId,
      campaignName,
      emailsSent: 0,
      contacted: 0,
      opensUnique: 0,
      openRate: 0,
      repliesUnique: 0,
      replyRate: 0,
      bounced: 0,
      bounceRate: 0,
      unsubscribed: 0,
      interested: 0,
      meetingBooked: 0,
    };
  }

  const d = await res.json();
  const sent = d.emails_sent_count || 0;
  const contacted = d.contacted_count || 0;
  const opens = d.open_count_unique || 0;
  const replies = d.reply_count_unique || 0;
  const bounced = d.bounced_count || 0;

  return {
    campaignId,
    campaignName,
    emailsSent: sent,
    contacted,
    opensUnique: opens,
    openRate: contacted > 0 ? Math.round((opens / contacted) * 100) : 0,
    repliesUnique: replies,
    replyRate: contacted > 0 ? Math.round((replies / contacted) * 100) : 0,
    bounced,
    bounceRate: sent > 0 ? Math.round((bounced / sent) * 100) : 0,
    unsubscribed: d.unsubscribed_count || 0,
    interested: d.total_interested || 0,
    meetingBooked: d.total_meeting_booked || 0,
  };
}

export async function GET(req: NextRequest) {
  if (!INSTANTLY_API_KEY) {
    return NextResponse.json(
      { error: "INSTANTLY_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const campaignIdsParam = searchParams.get("campaignIds");

    let campaigns: { id: string; name: string }[];

    if (campaignIdsParam) {
      // Caller specified which campaigns to fetch
      const ids = campaignIdsParam.split(",").filter(Boolean);
      // We still need names — fetch the full list and filter
      const allCampaigns = await fetchCampaignList();
      const nameMap = Object.fromEntries(allCampaigns.map((c) => [c.id, c.name]));
      campaigns = ids.map((id) => ({ id, name: nameMap[id] || id }));
    } else {
      campaigns = await fetchCampaignList();
    }

    // Fetch analytics for each campaign in parallel
    const analytics = await Promise.all(
      campaigns.map((c) => fetchCampaignAnalytics(c.id, c.name))
    );

    return NextResponse.json({ analytics });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
