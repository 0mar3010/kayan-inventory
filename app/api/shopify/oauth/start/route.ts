import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSessionEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SCOPES = process.env.SHOPIFY_SCOPES ?? "read_products,read_inventory";
export const OAUTH_STATE_COOKIE = "kayan_shopify_oauth_state";

// Kicks off Shopify's authorization-code flow. Staff-only: the resulting
// offline token can read the whole catalog.
export async function GET(request: NextRequest) {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!domain || !apiKey) {
    return NextResponse.json(
      { error: "Set SHOPIFY_STORE_DOMAIN and SHOPIFY_API_KEY before connecting Shopify" },
      { status: 400 }
    );
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/shopify/oauth/callback", request.url).toString();

  const authorize = new URL(`https://${domain}/admin/oauth/authorize`);
  authorize.searchParams.set("client_id", apiKey);
  authorize.searchParams.set("scope", SCOPES);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("state", state);
  // No grant_options[] => offline token (shpat_...), valid until uninstall.

  const response = NextResponse.redirect(authorize.toString());
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600, // 10 minutes
  });
  return response;
}
