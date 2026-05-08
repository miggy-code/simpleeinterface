import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Throttl Outreach",
  description:
    "Throttl internal outreach interface for Airtable leads, DeBounce verification, and Instantly campaigns.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans bg-ink-50 min-h-screen">
        <header className="border-b border-ink-200 bg-white sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-ink-900 font-semibold tracking-tight"
            >
              {/* Throttl wordmark */}
              <span className="w-7 h-7 rounded-md bg-ink-900 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">T</span>
              </span>
              <span className="text-base">Throttl</span>
              <span className="text-xs text-ink-400 font-mono">Outreach</span>
            </Link>
            <div className="flex items-center gap-3 text-xs text-ink-400 font-mono">
              <span className="hidden sm:inline">
                Airtable · DeBounce · Instantly
              </span>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
        <footer className="max-w-7xl mx-auto px-6 pb-8 text-xs text-ink-300 font-mono">
          Throttl internal tool · not for external distribution
        </footer>
      </body>
    </html>
  );
}
