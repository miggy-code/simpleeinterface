import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * Lead creation is intentionally not supported in this interface.
 * All leads enter the system via Airtable directly (AI prospecting, manual entry,
 * CSV import, etc.). This page redirects to the dashboard.
 */
export default function NewLeadPage() {
  redirect("/");
}
