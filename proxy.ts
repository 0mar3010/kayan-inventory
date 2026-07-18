import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";

// autoplan T2: gate the review-queue write path behind a session before
// it's ever used for real approvals. Full Auth.js/RBAC is still Phase 0
// roadmap work — this is the minimal non-spoofable-identity stopgap.
export function proxy(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const email = verifySessionCookieValue(cookie);

  if (!email) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized — sign in required" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Gate the internal surfaces: the sales dashboard (root), its product-search
// API, and the review-queue write path. `/login` and `/api/auth/*` are
// deliberately absent so the sign-in flow itself stays reachable.
export const config = {
  matcher: [
    "/",
    "/sync/:path*",
    "/api/products/:path*",
    "/api/sync/:path*",
    "/review-queue/:path*",
    "/api/review-queue/:path*",
  ],
};
