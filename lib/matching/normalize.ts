import { prisma } from "@/lib/prisma";

/**
 * Normalize a raw model number / SKU for matching.
 * Strips whitespace/punctuation, uppercases, then strips the
 * longest matching known brand prefix (e.g. "SON-" for Sonai).
 * Prefixes live in the BrandPrefix table, not in code, so new
 * ones don't need a redeploy.
 */
// Brand prefixes rarely change and are tiny. Load them all once per process
// instead of a DB round-trip per row — a 500-row Excel ingest was otherwise
// 500 extra queries. A new prefix takes effect on the next cold start.
let prefixCache: Map<string, string[]> | null = null;

async function getPrefixes(): Promise<Map<string, string[]>> {
  if (prefixCache) return prefixCache;
  const rows = await prisma.brandPrefix.findMany();
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const clean = r.prefix.toUpperCase().replace(/[^A-Z0-9]/g, "");
    (map.get(r.brand) ?? map.set(r.brand, []).get(r.brand)!).push(clean);
  }
  for (const arr of map.values()) arr.sort((a, b) => b.length - a.length); // longest first
  prefixCache = map;
  return map;
}

export async function normalizeIdentifier(raw: string, brand: string): Promise<string> {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const prefixes = (await getPrefixes()).get(brand) ?? [];
  for (const prefix of prefixes) {
    if (cleaned.startsWith(prefix)) {
      return cleaned.slice(prefix.length);
    }
  }

  return cleaned;
}
