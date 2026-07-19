import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/matching/product-lookup.service";

// Sales-safe: read-only product lookup. Available to SALES + ADMIN.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  try {
    const result = await searchProducts(q, page);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[products:search]", error);
    return NextResponse.json({ error: "Failed to search products" }, { status: 500 });
  }
}
