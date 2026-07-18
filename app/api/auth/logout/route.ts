import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

// Clears the session cookie and returns the user to the sign-in page.
// POST (not GET): a GET logout link gets auto-prefetched by Next.js
// <Link>, which would silently sign the user out on every page render.
// 303 so the browser follows with a GET to /login.
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
