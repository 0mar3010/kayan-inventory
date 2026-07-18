import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/matching/product-lookup.service";

// Sales-safe: read-only product lookup. Available to SALES + ADMIN.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  try {
    const products = await searchProducts(q);
    return NextResponse.json({ products });
  } catch (error) {
    console.error("[products:search]", error);
    return NextResponse.json({ error: "Failed to search products" }, { status: 500 });
  }
}
