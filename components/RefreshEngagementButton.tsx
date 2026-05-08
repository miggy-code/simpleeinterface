"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/api";

export function RefreshEngagementButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function refresh() {
    setBusy(true);
    setMsg(null);
    try {
      const data = await apiFetch<{
        synced: number;
        total?: number;
        errors?: string[];
      }>("/api/engagement/refresh", {
        method: "POST",
        fallbackError: "Sync failed",
      });
      setMsg(
        `Synced ${data.synced} of ${data.total ?? "?"} (${data.errors?.length ?? 0} errors)`
      );
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={refresh}
        disabled={busy}
        className="btn-secondary"
      >
        {busy ? "Syncing…" : "↻ Refresh engagement"}
      </button>
      {msg && <span className="text-xs text-ink-500 font-mono">{msg}</span>}
    </div>
  );
}
