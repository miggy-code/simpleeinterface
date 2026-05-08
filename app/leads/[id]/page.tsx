import Link from "next/link";
import { getLead } from "@/lib/airtable";
import { LeadDetailClient } from "@/components/LeadDetailClient";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const lead = await getLead(params.id);
  if (!lead) notFound();

  return (
    <div>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 mb-5 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to dashboard
      </Link>
      <LeadDetailClient lead={lead} />
    </div>
  );
}
