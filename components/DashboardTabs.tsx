"use client";

import { useState } from "react";
import { Lead } from "@/lib/schema";
import { CampaignsTab } from "./CampaignsTab";
import { IngestionDashboard } from "./IngestionDashboard";

interface Props {
  leads: Lead[];
  leadsError: string | null;
}

type Tab = "leads" | "campaigns";

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <strong>Error loading data:</strong> {message}
    </div>
  );
}

export function DashboardTabs({ leads, leadsError }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("leads");
  const queueCount = leads.filter((lead) => lead.pipelineStatus !== "In Campaign").length;
  const campaignCount = leads.filter((lead) => lead.pipelineStatus === "In Campaign").length;

  return (
    <div className="space-y-6 pb-8">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(250,243,236,0.94)_45%,rgba(247,244,238,0.98))] px-6 py-6 shadow-[0_32px_90px_-42px_rgba(14,14,8,0.42)] sm:px-8">
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,_rgba(193,96,43,0.18),_transparent_58%)] lg:block" />
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
          Internal workflow
        </p>
        <div className="relative mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold text-ink-900 sm:text-[2.15rem]">
              Send the Throttl AI toolkit campaign
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-500">
              Clean Airtable lead fields inline, verify emails with DeBounce, and push safe leads into assigned Instantly campaigns.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/80 bg-white/75 px-4 py-3 shadow-[0_16px_40px_-28px_rgba(14,14,8,0.5)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-400">
                Active queue
              </div>
              <div className="mt-2 text-2xl font-semibold text-ink-900">{queueCount}</div>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/75 px-4 py-3 shadow-[0_16px_40px_-28px_rgba(14,14,8,0.5)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-400">
                In campaign
              </div>
              <div className="mt-2 text-2xl font-semibold text-ink-900">{campaignCount}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[1.6rem] border border-white/70 bg-white/75 p-2 shadow-[0_22px_70px_-48px_rgba(14,14,8,0.45)] backdrop-blur">
        <nav className="flex flex-wrap gap-2" aria-label="Dashboard tabs">
          <button
            onClick={() => setActiveTab("leads")}
            className={`flex-1 rounded-[1.1rem] px-5 py-4 text-left text-sm font-medium transition-all sm:flex-none sm:min-w-[220px] ${
              activeTab === "leads"
                ? "bg-ink-900 text-white shadow-[0_20px_40px_-28px_rgba(14,14,8,0.9)]"
                : "text-ink-500 hover:bg-white hover:text-ink-800"
            }`}
          >
            <span className="flex items-center gap-2">
              Leads
              <span
                className={`inline-flex h-5 min-w-[1.35rem] items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                  activeTab === "leads"
                    ? "bg-white/15 text-white"
                    : "bg-ink-100 text-ink-600"
                }`}
              >
                {queueCount}
              </span>
            </span>
            <span
              className={`mt-1 block text-xs font-normal ${
                activeTab === "leads" ? "text-white/65" : "text-ink-400"
              }`}
            >
              Review · verify · push
            </span>
          </button>
          <button
            onClick={() => setActiveTab("campaigns")}
            className={`flex-1 rounded-[1.1rem] px-5 py-4 text-left text-sm font-medium transition-all sm:flex-none sm:min-w-[220px] ${
              activeTab === "campaigns"
                ? "bg-ink-900 text-white shadow-[0_20px_40px_-28px_rgba(14,14,8,0.9)]"
                : "text-ink-500 hover:bg-white hover:text-ink-800"
            }`}
          >
            <span>Campaigns</span>
            <span
              className={`mt-1 block text-xs font-normal ${
                activeTab === "campaigns" ? "text-white/65" : "text-ink-400"
              }`}
            >
              Sequence builder
            </span>
          </button>
        </nav>
      </div>

      {activeTab === "leads" && (
        <>
          {leadsError && <ErrorBanner message={leadsError} />}
          <IngestionDashboard leads={leads} />
        </>
      )}
      {activeTab === "campaigns" && <CampaignsTab />}
    </div>
  );
}
