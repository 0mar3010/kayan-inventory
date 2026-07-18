import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

// Clears the session cookie and returns the user to the sign-in page.
// GET so it can be a plain link in the header; the cookie is httpOnly
// so there's nothing sensitive to protect against CSRF here (worst case
// an attacker signs a user out).
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
