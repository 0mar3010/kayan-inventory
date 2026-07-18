"use client";

import { useEffect, useState } from "react";
import type { ReviewQueueSummary, ReviewItemDetail as ReviewItemDetailType } from "@/lib/matching/review-queue.service";
import { ReviewQueueList } from "./ReviewQueueList";
import { ReviewItemDetail } from "./ReviewItemDetail";

interface Props {
  initialItems: ReviewQueueSummary[];
  reviewerEmail: string;
}

// autoplan T2: reviewerEmail comes from the server-derived session (page.tsx),
// not a free-text field — confirmedBy is never client-supplied. The approve/
// reject routes read the actor from the session, so nothing identity-bearing
// is sent in the request body here.
export function ReviewQueueClient({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReviewItemDetailType | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function selectItem(id: string) {
    setSelectedId(id);
    setDetail(null);
    setActionError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/review-queue/${id}`);
      if (!res.ok) throw new Error("Failed to load item detail");
      const data: ReviewItemDetailType = await res.json();
      setDetail(data);
    } catch {
      setActionError("تعذّر تحميل هذا الصف. حاول اختياره مجدداً.");
    } finally {
      setDetailLoading(false);
    }
  }

  function removeFromList(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedId(null);
    setDetail(null);
  }

  async function handleApprove(productId: string) {
    if (!selectedId) return;
    setActionPending(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/review-queue/${selectedId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedProductId: productId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Approve failed");
      removeFromList(selectedId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setActionPending(false);
    }
  }

  async function handleReject(reason?: string) {
    if (!selectedId) return;
    setActionPending(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/review-queue/${selectedId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reject failed");
      removeFromList(selectedId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setActionPending(false);
    }
  }

  // Keyboard nav: J/K to move through the list, A to approve the top
  // candidate, R to reject. Ignored while typing in a text field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      const i = items.findIndex((x) => x.id === selectedId);
      if (e.key === "j" && i < items.length - 1) selectItem(items[i + 1].id);
      if (e.key === "k" && i > 0) selectItem(items[i - 1].id);
      if (e.key === "a" && detail?.candidates[0]) handleApprove(detail.candidates[0].productId);
      if (e.key === "r" && selectedId) handleReject();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, selectedId, detail]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      <ReviewQueueList items={items} selectedId={selectedId} onSelect={selectItem} />
      <ReviewItemDetail
        detail={detail}
        loading={detailLoading}
        actionPending={actionPending}
        actionError={actionError}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}
