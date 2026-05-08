import { listLeads } from "@/lib/airtable";
import { FIELD_NAME } from "@/lib/schema";
import { DashboardTabs } from "@/components/DashboardTabs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const leadsResult = await Promise.resolve(
    listLeads({ sort: [{ field: FIELD_NAME.sourceDate, direction: "desc" }] })
  ).then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ status: "rejected" as const, reason })
  );
  const leads = leadsResult.status === "fulfilled" ? leadsResult.value : [];

  return (
    <DashboardTabs
      leads={leads}
      leadsError={
        leadsResult.status === "rejected"
          ? String(leadsResult.reason)
          : null
      }
    />
  );
}
