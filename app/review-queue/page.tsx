import { listPendingReviewItems } from "@/lib/matching/review-queue.service";
import { getSessionEmail } from "@/lib/auth";
import { ReviewQueueClient } from "@/components/review-queue/ReviewQueueClient";

// Live, per-session, DB-backed page behind auth — never statically prerender.
export const dynamic = "force-dynamic";

// Gated by middleware.ts (session required). ADMIN-only role restriction
// (sales staff should never see this screen) is still Phase 0 roadmap
// work — this stopgap only guarantees *some* signed-in identity.
export default async function ReviewQueuePage() {
  const items = await listPendingReviewItems();
  const reviewerEmail = await getSessionEmail(); // non-null: middleware already gated this route

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Review queue</h1>
            <p className="mt-1 text-sm text-slate-500">
              Rows the matcher couldn&apos;t confidently place on its own. Confirm the right product, or reject if none fit.
            </p>
          </div>
          <p className="text-sm text-slate-500">Signed in as {reviewerEmail}</p>
        </header>
        <ReviewQueueClient initialItems={items} reviewerEmail={reviewerEmail ?? ""} />
      </div>
    </main>
  );
}
