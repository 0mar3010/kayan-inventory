"use client";

import { useState } from "react";

interface Summary {
  variantsPulled: number;
  matched: number;
  priceUpdated: number;
  snapshotsWritten: number;
}

export function ShopifyRefreshClient() {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Summary | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/sync/shopify", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `فشل التحديث (HTTP ${res.status})`);
      setResult(data as Summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل التحديث");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-2xl border border-kayan-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-kayan-ink">تحديث من شوبيفاي</h2>
          <p className="mt-0.5 text-sm text-kayan-muted">اسحب الأسعار والمخزون والصور الحالية من متجر شوبيفاي.</p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-xl bg-kayan-ink px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-4 w-4 ${running ? "animate-spin" : ""}`}
          >
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <path d="M21 3v5h-5" />
          </svg>
          {running ? "جارِ التحديث…" : "تحديث الآن"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-kayan-red/30 bg-kayan-red-tint px-4 py-3 text-sm text-kayan-red">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat label="أصناف شوبيفاي" value={result.variantsPulled} />
          <Stat label="حُدّث السعر" value={result.priceUpdated} tone="ok" />
          <Stat label="حُدّث المخزون" value={result.snapshotsWritten} tone="ok" />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" }) {
  return (
    <div className="rounded-xl border border-kayan-line bg-kayan-bg p-3 text-center">
      <div className="text-xs font-semibold text-kayan-muted">{label}</div>
      <div className={`tnum mt-1 font-display text-xl font-bold ${tone === "ok" ? "text-kayan-ok" : "text-kayan-ink"}`}>
        {value}
      </div>
    </div>
  );
}
