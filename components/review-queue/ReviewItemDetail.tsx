"use client";

import { useEffect, useState } from "react";
import type { ReviewItemDetail as ReviewItemDetailType } from "@/lib/matching/review-queue.service";
import { CandidateCard } from "./CandidateCard";

// oldQuantity/newQuantity come from the service patch in MERGE.md.
type DetailWithDelta = ReviewItemDetailType & {
  oldQuantity?: number | null;
  newQuantity?: number | null;
};

interface Props {
  detail: DetailWithDelta | null;
  loading: boolean;
  actionPending: boolean;
  actionError: string | null;
  onApprove: (productId: string) => void;
  onReject: (reason?: string) => void;
}

const REASON_COPY: Record<string, string> = {
  quantity_jump_over_5x:
    "قفزة كمية أكبر من ٥ أضعاف آخر كمية مسجّلة لهذا المنتج. تأكّد أن هذا صحيح قبل الاعتماد.",
  brand_mismatch: "العلامة التجارية لا تطابق هذا الصف. لا ينبغي اعتماد هذا الترشيح.",
};

export function ReviewItemDetail({ detail, loading, actionPending, actionError, onApprove, onReject }: Props) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  useEffect(() => {
    setSelectedProductId(detail?.candidates[0]?.productId ?? null);
    setShowRejectInput(false);
    setRejectReason("");
  }, [detail?.id]);

  if (loading) {
    return (
      <div aria-busy="true" aria-label="جارِ التحميل" className="space-y-3 rounded-2xl border border-kayan-line bg-white p-6 shadow-sm">
        <div className="h-4 w-1/3 animate-pulse rounded bg-kayan-bg" />
        <div className="h-16 animate-pulse rounded bg-kayan-bg" />
        <div className="h-16 animate-pulse rounded bg-kayan-bg" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-kayan-line bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-kayan-muted">اختر صفاً من القائمة لمراجعته.</p>
      </div>
    );
  }

  const oldQty = detail.oldQuantity ?? null;
  const newQty = detail.newQuantity ?? detail.quantity;
  const showDelta = newQty !== null && newQty !== undefined;
  const jump =
    oldQty === null ? "جديد" : `${oldQty === 0 ? "+∞" : (newQty! - oldQty >= 0 ? "+" : "") + Math.round(((newQty! - oldQty) / oldQty) * 100) + "%"}`;

  return (
    <div className="space-y-4 rounded-2xl border border-kayan-line bg-white p-5 shadow-sm">
      <div>
        <div className="font-mono text-lg font-bold text-kayan-ink">{detail.rawModelNumber}</div>
        <div className="mt-0.5 text-sm text-kayan-muted">
          {detail.brand} · كمية {detail.quantity} · صف الملف {detail.fileRowNumber}
        </div>
      </div>

      {detail.guardrailReasons.length > 0 && (
        <div role="alert" className="flex gap-2.5 rounded-xl border border-kayan-warn bg-kayan-warn-tint p-3 text-sm leading-relaxed text-[#7A4E10]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-kayan-warn">
            <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          <div className="space-y-1">
            {detail.guardrailReasons.map((reason) => (
              <p key={reason}>{REASON_COPY[reason] ?? reason}</p>
            ))}
          </div>
        </div>
      )}

      {showDelta && (
        <div className="flex items-center gap-3 rounded-xl border border-kayan-line bg-kayan-bg px-4 py-3">
          <div className="text-center">
            <div className="text-[11px] font-semibold text-kayan-muted">الكمية السابقة</div>
            <div className="tnum font-mono text-[22px] font-bold text-kayan-ink">{oldQty ?? "—"}</div>
          </div>
          <span className="text-kayan-muted" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 -scale-x-100">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
          <div className="text-center">
            <div className="text-[11px] font-semibold text-kayan-muted">الكمية الجديدة</div>
            <div className="tnum font-mono text-[22px] font-bold text-kayan-red">{newQty}</div>
          </div>
          <span className="ms-auto rounded-full bg-kayan-red-tint px-2.5 py-1 text-[13px] font-bold text-kayan-red">{jump}</span>
        </div>
      )}

      {detail.candidates.length === 0 ? (
        <p className="text-sm text-kayan-muted">لا توجد ترشيحات لهذا الصف.</p>
      ) : (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-kayan-ink-2">المطابقات المحتملة</h3>
          {detail.candidates.map((candidate) => (
            <CandidateCard
              key={candidate.productId}
              candidate={candidate}
              selected={candidate.productId === selectedProductId}
              onSelect={setSelectedProductId}
            />
          ))}
        </div>
      )}

      {actionError && (
        <p role="alert" className="text-sm text-kayan-red">
          {actionError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-kayan-line pt-4">
        <button
          type="button"
          disabled={!selectedProductId || actionPending}
          onClick={() => selectedProductId && onApprove(selectedProductId)}
          className="rounded-xl bg-kayan-red px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-kayan-red-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {actionPending ? "جارِ الاعتماد…" : "اعتماد المطابقة المحددة"}
        </button>

        {!showRejectInput ? (
          <button
            type="button"
            disabled={actionPending}
            onClick={() => setShowRejectInput(true)}
            className="rounded-xl border border-kayan-line px-4 py-2 text-sm font-bold text-kayan-ink-2 transition-colors hover:border-[#CFCBCB] disabled:cursor-not-allowed disabled:opacity-50"
          >
            لا يطابق أياً منها
          </button>
        ) : (
          <div className="flex w-full items-center gap-2 pt-2">
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="السبب؟ (اختياري)"
              className="flex-1 rounded-lg border border-kayan-line px-3 py-1.5 font-ar text-sm focus:border-kayan-red focus:outline-none focus:ring-2 focus:ring-kayan-red-tint"
            />
            <button
              type="button"
              disabled={actionPending}
              onClick={() => onReject(rejectReason.trim() || undefined)}
              className="rounded-lg bg-kayan-red px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-kayan-red-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionPending ? "جارِ الرفض…" : "تأكيد الرفض"}
            </button>
          </div>
        )}

        <div className="ms-auto flex items-center gap-3 text-xs text-kayan-muted">
          <Kbd k="A" label="اعتماد" />
          <Kbd k="R" label="رفض" />
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-b-2 border-kayan-line bg-kayan-bg px-1.5 py-0.5 font-mono text-[11px] font-bold text-kayan-ink-2">J</kbd>
            <span>/</span>
            <kbd className="rounded border border-b-2 border-kayan-line bg-kayan-bg px-1.5 py-0.5 font-mono text-[11px] font-bold text-kayan-ink-2">K</kbd>
            تنقّل
          </span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ k, label }: { k: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="rounded border border-b-2 border-kayan-line bg-kayan-bg px-1.5 py-0.5 font-mono text-[11px] font-bold text-kayan-ink-2">{k}</kbd>
      {label}
    </span>
  );
}
