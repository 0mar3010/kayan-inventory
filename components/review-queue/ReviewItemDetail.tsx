"use client";

import { useState } from "react";
import type { ReviewItemDetail as ReviewItemDetailType } from "@/lib/matching/review-queue.service";
import { CandidateCard } from "./CandidateCard";

interface Props {
  detail: ReviewItemDetailType | null;
  loading: boolean;
  actionPending: boolean;
  actionError: string | null;
  onApprove: (productId: string) => void;
  onReject: (reason?: string) => void;
}

const REASON_COPY: Record<string, string> = {
  quantity_jump_over_5x:
    "Stock quantity would jump more than 5x the last recorded amount for this product. Confirm this is correct before approving.",
  brand_mismatch: "Brand doesn't match this row. This candidate should not be approved.",
};

export function ReviewItemDetail({ detail, loading, actionPending, actionError, onApprove, onReject }: Props) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  // Reset per-item UI state when the reviewed item changes. Adjusted during
  // render (not in an effect) per https://react.dev/learn/you-might-not-need-an-effect
  // — avoids the extra render pass a useEffect-based reset would cause.
  const [lastDetailId, setLastDetailId] = useState(detail?.id);
  if (detail?.id !== lastDetailId) {
    setLastDetailId(detail?.id);
    setSelectedProductId(detail?.candidates[0]?.productId ?? null);
    setShowRejectInput(false);
    setRejectReason("");
  }

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading item" className="space-y-3 rounded-lg border border-slate-200 bg-white p-6">
        <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
        <div className="h-16 animate-pulse rounded bg-slate-200" />
        <div className="h-16 animate-pulse rounded bg-slate-200" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">Select a row from the queue to review it.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <div>
        <div className="font-mono text-base text-slate-900">{detail.rawModelNumber}</div>
        <div className="mt-0.5 text-sm text-slate-500">
          {detail.brand} · qty {detail.quantity} · file row {detail.fileRowNumber}
        </div>
      </div>

      {detail.guardrailReasons.length > 0 && (
        <div role="alert" className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3">
          {detail.guardrailReasons.map((reason) => (
            <p key={reason} className="text-sm text-amber-900">
              {REASON_COPY[reason] ?? reason}
            </p>
          ))}
        </div>
      )}

      {detail.candidates.length === 0 ? (
        <p className="text-sm text-slate-500">No candidates found for this row.</p>
      ) : (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-700">Possible matches</h3>
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
        <p role="alert" className="text-sm text-red-700">
          {actionError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          disabled={!selectedProductId || actionPending}
          onClick={() => selectedProductId && onApprove(selectedProductId)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {actionPending ? "Approving…" : "Approve selected match"}
        </button>

        {!showRejectInput ? (
          <button
            type="button"
            disabled={actionPending}
            onClick={() => setShowRejectInput(true)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            None of these match
          </button>
        ) : (
          <div className="flex w-full items-center gap-2 pt-2">
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why? (optional)"
              className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            <button
              type="button"
              disabled={actionPending}
              onClick={() => onReject(rejectReason.trim() || undefined)}
              className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionPending ? "Rejecting…" : "Confirm reject"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
