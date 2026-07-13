import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * autoplan T2 — minimal auth stopgap, not the final auth system.
 * Roadmap (CLAUDE.md section 9, Phase 0) still calls for full Auth.js
 * with SALES/ADMIN roles wired into middleware. This gives the
 * review-queue write path a non-spoofable actor identity now, so it
 * isn't live with zero auth in the meantime — "even a single shared
 * login is enough" per the /autoplan review finding.
 */

export const SESSION_COOKIE_NAME = "kayan_session";

// Any non-empty value works for local dev; set a real secret in prod.
const SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

export function createSessionCookieValue(email: string): string {
  const payload = Buffer.from(email, "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionCookieValue(cookieValue: string | undefined | null): string | null {
  if (!cookieValue) return null;
  const [payload, sig] = cookieValue.split(".");
  if (!payload || !sig) return null;

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Server-side session read for API routes and server components.
 * Route handlers use this for `confirmedBy` — never the request body.
 */
export async function getSessionEmail(): Promise<string | null> {
  const store = await cookies();
  return verifySessionCookieValue(store.get(SESSION_COOKIE_NAME)?.value);
}
