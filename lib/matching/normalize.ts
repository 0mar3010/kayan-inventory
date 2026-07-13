import { prisma } from "@/lib/prisma";

/**
 * Normalize a raw model number / SKU for matching.
 * Strips whitespace/punctuation, uppercases, then strips the
 * longest matching known brand prefix (e.g. "SON-" for Sonai).
 * Prefixes live in the BrandPrefix table, not in code, so new
 * ones don't need a redeploy.
 */
export async function normalizeIdentifier(raw: string, brand: string): Promise<string> {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const prefixRows = await prisma.brandPrefix.findMany({ where: { brand } });

  const prefixes = prefixRows
    .map((p) => p.prefix.toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .sort((a, b) => b.length - a.length); // longest first, avoid short false-positive strip

  for (const prefix of prefixes) {
    if (cleaned.startsWith(prefix)) {
      return cleaned.slice(prefix.length);
    }
  }

  return cleaned;
}
