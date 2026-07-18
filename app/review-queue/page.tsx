import { listPendingReviewItems } from "@/lib/matching/review-queue.service";
import { getSessionEmail } from "@/lib/auth";
import { ReviewQueueClient } from "@/components/review-queue/ReviewQueueClient";
import { AppHeader } from "@/components/layout/AppHeader";

// Live, per-session, DB-backed page behind auth — never statically prerender.
export const dynamic = "force-dynamic";

// Gated by proxy.ts (session required). ADMIN-only role restriction
// (sales staff should never see this screen) is still Phase 0 roadmap
// work — this stopgap only guarantees *some* signed-in identity.
export default async function ReviewQueuePage() {
  const items = await listPendingReviewItems();
  const reviewerEmail = await getSessionEmail(); // non-null: proxy already gated this route

  return (
    <>
      <AppHeader active="review-queue" email={reviewerEmail ?? undefined} />
      <main className="mx-auto max-w-6xl px-4 py-8 pb-16">
        <header className="mb-6">
          <h1 className="font-display text-[22px] font-bold text-kayan-ink">قائمة المراجعة</h1>
          <p className="mt-0.5 text-sm text-kayan-muted">
            صفوف لم يستطع المُطابِق وضعها بثقة كافية. اعتمد المنتج الصحيح، أو ارفض إن لم يطابق أيٌّ منها.
          </p>
        </header>
        <ReviewQueueClient initialItems={items} reviewerEmail={reviewerEmail ?? ""} />
      </main>
    </>
  );
}
