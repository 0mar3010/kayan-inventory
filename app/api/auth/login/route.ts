import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";

// autoplan T2 stopgap: one shared team password (env var) plus an email
// to identify the actor in ActivityLog/confirmedBy. Not the final auth
// system — see CLAUDE.md section 9, Phase 0 (full Auth.js + roles).
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const teamPassword = process.env.TEAM_LOGIN_PASSWORD;
  if (!teamPassword) {
    return NextResponse.json(
      { error: "Server misconfigured: TEAM_LOGIN_PASSWORD is not set" },
      { status: 500 }
    );
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (password !== teamPassword) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  const response = NextResponse.json({ email: user.email });
  response.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(user.email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return response;
}
