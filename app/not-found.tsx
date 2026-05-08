import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card p-12 text-center max-w-md mx-auto">
      <h2 className="text-2xl font-semibold mb-2">Lead not found</h2>
      <p className="text-sm text-ink-500 mb-4">
        That record doesn&apos;t exist in Airtable.
      </p>
      <Link href="/" className="btn-primary">
        Back to pipeline
      </Link>
    </div>
  );
}
