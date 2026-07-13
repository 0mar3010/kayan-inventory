import { NextRequest, NextResponse } from "next/server";
import { listPendingReviewItems } from "@/lib/matching/review-queue.service";

// Gated by middleware.ts (session required) — ADMIN-vs-SALES role
// separation is still Phase 0 roadmap work (full Auth.js).
export async function GET(request: NextRequest) {
  const syncRunId = request.nextUrl.searchParams.get("syncRunId") ?? undefined;

  try {
    const items = await listPendingReviewItems(syncRunId);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[review-queue:list]", error);
    return NextResponse.json({ error: "Failed to load review queue" }, { status: 500 });
  }
}
