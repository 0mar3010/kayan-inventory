import { NextRequest, NextResponse } from "next/server";
import { rejectReviewItem } from "@/lib/matching/review-queue.service";
import { getSessionEmail } from "@/lib/auth";

// autoplan T2: confirmedBy comes from the verified session, never the
// request body.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  const confirmedBy = await getSessionEmail();
  if (!confirmedBy) {
    return NextResponse.json({ error: "Unauthorized — sign in required" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const reason = body?.reason as string | undefined;

  try {
    const updated = await rejectReviewItem({ itemId, confirmedBy, reason });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[review-queue:reject]", error);
    const message = error instanceof Error ? error.message : "Reject failed";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
