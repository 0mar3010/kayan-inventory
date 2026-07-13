import { NextRequest, NextResponse } from "next/server";
import { getReviewItemDetail } from "@/lib/matching/review-queue.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  try {
    const detail = await getReviewItemDetail(itemId);
    return NextResponse.json(detail);
  } catch (error) {
    console.error("[review-queue:detail]", error);
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
}
