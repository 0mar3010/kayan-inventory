import { NextRequest, NextResponse } from "next/server";
import { approveReviewItem, InvalidCandidateError } from "@/lib/matching/review-queue.service";
import { getSessionEmail } from "@/lib/auth";

// autoplan T2: confirmedBy comes from the verified session, never the
// request body — middleware.ts already gates this route, this is
// defense-in-depth plus the actual source of the audited identity.
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
  const selectedProductId = body?.selectedProductId;

  if (!selectedProductId) {
    return NextResponse.json({ error: "selectedProductId is required" }, { status: 400 });
  }

  try {
    const updated = await approveReviewItem({
      itemId,
      selectedProductId,
      confirmedBy,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[review-queue:approve]", error);
    // autoplan T1: an invalid-candidate rejection is a bad request, not a
    // data conflict — 400, distinct from the 409 conflict path below.
    if (error instanceof InvalidCandidateError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Approve failed";
    // 409: conflicts (already approved, or confirmMapping hit a
    // real crosswalk conflict) are the expected failure mode here.
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
