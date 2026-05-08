import Link from "next/link";
import { CampaignEmailEditor } from "@/components/CampaignEmailEditor";

export const dynamic = "force-dynamic";

export default function CampaignEditorPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link
          href="/"
          className="text-xs text-ink-500 hover:text-ink-900 transition-colors inline-flex items-center gap-1 mb-3"
        >
          ← Back to dashboard
        </Link>
        <h1 className="text-xl font-semibold text-ink-900">Campaign Email Editor</h1>
        <p className="text-sm text-ink-500 mt-1">
          View and edit the email templates for each step in your Instantly campaigns.
          Changes are saved directly to Instantly.
        </p>
      </div>
      <CampaignEmailEditor />
    </div>
  );
}
