import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { shopifyConfigured } from "@/lib/shopify/client";
import { syncFromShopify } from "@/lib/shopify/sync.service";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST() {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized — sign in required" }, { status: 401 });
  }

  if (!shopifyConfigured()) {
    return NextResponse.json(
      { error: "Shopify not connected — set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN in the server env" },
      { status: 400 }
    );
  }

  try {
    const summary = await syncFromShopify();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[sync:shopify]", error);
    const message = error instanceof Error ? error.message : "Shopify sync failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
