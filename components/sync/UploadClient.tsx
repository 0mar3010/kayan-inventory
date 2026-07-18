"use client";

import { useRef, useState } from "react";
import Link from "next/link";

interface Summary {
  syncRunId: string;
  total: number;
  autoApplied: number;
  needsReview: number;
  unmatched: number;
}

export function UploadClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Summary | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/sync/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `فشل الرفع (HTTP ${res.status})`);
      setResult(data as Summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الرفع");
    } finally {
      setUploading(false);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    upload(file);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-dashed border-kayan-line bg-white p-8 text-center shadow-sm">
        <input
          ref={inputRef}
          type="file"
          accept=".xls,.xlsx"
          onChange={onPick}
          className="hidden"
          disabled={uploading}
        />
        <p className="text-sm font-semibold text-kayan-ink">ارفع ملف المخزون المحلي</p>
        <p className="mt-1 text-sm text-kayan-muted">Excel ‏(‎.xls أو .xlsx‏) — أعمدة: الرصيد، أسم الصنف، رقم الموديل</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="mt-4 rounded-xl bg-kayan-red px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-kayan-red-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? "جارِ المعالجة…" : "اختر ملف"}
        </button>
        {fileName && <p className="mt-3 truncate text-xs text-kayan-muted">{fileName}</p>}
      </div>

      {uploading && (
        <p className="text-center text-sm text-kayan-muted" role="status">
          يُطابق الأصناف مع كتالوج شوبيفاي… قد يستغرق حتى دقيقة.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-kayan-red/30 bg-kayan-red-tint px-4 py-3 text-sm text-kayan-red">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="إجمالي الأصناف" value={result.total} />
            <Stat label="حُدّث تلقائياً" value={result.autoApplied} tone="ok" />
            <Stat label="بانتظار المراجعة" value={result.needsReview} tone="warn" />
            <Stat label="غير مطابق" value={result.unmatched} tone="muted" />
          </div>
          {result.needsReview > 0 && (
            <Link
              href="/review-queue"
              className="inline-block rounded-xl bg-kayan-ink px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-black"
            >
              راجع {result.needsReview} صف بانتظار القرار ←
            </Link>
          )}
          <p className="text-xs text-kayan-muted">
            الأصناف المُحدَّثة تلقائياً كانت مطابقة تامة لرقم الموديل. غير المطابقة لم تُمَس (لا كتابة خاطئة).
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "muted" }) {
  const color =
    tone === "ok" ? "text-kayan-ok" : tone === "warn" ? "text-kayan-warn" : tone === "muted" ? "text-kayan-muted" : "text-kayan-ink";
  return (
    <div className="rounded-xl border border-kayan-line bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold text-kayan-muted">{label}</div>
      <div className={`tnum mt-1 font-display text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
