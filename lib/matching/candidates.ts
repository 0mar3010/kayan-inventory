import { prisma } from "@/lib/prisma";
import type { SourceSystem } from "@prisma/client";
import type { MatchCandidate } from "./types";

/** Exact match on normalizedId — O(1) via the unique/btree index. */
export async function findExactMatch(normalizedId: string, source: SourceSystem) {
  return prisma.productIdentifier.findFirst({
    where: { normalizedId, source },
  });
}

/**
 * Fuzzy candidates via pg_trgm similarity, restricted to the
 * same brand at the query level (guardrail applied here, not
 * just after — never even fetch a cross-brand candidate).
 * Requires the manual GIN trgm index noted in schema.prisma.
 */
export async function findFuzzyCandidates(
  normalizedId: string,
  brand: string,
  limit = 5
): Promise<MatchCandidate[]> {
  const rows = await prisma.$queryRaw<
    Array<{ productId: string; identifierId: string; similarity: number }>
  >`
    SELECT
      p.id  AS "productId",
      pi.id AS "identifierId",
      similarity(pi."normalizedId", ${normalizedId}) AS similarity
    FROM "ProductIdentifier" pi
    JOIN "Product" p ON p.id = pi."productId"
    WHERE p.brand = ${brand}
      AND similarity(pi."normalizedId", ${normalizedId}) > 0.3
    ORDER BY similarity DESC
    LIMIT ${limit}
  `;

  if (rows.length === 0) return [];

  const [products, identifiers] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: rows.map((r) => r.productId) } } }),
    prisma.productIdentifier.findMany({ where: { id: { in: rows.map((r) => r.identifierId) } } }),
  ]);

  // autoplan T3: the raw SQL query and these batch fetches are not in the
  // same transaction/snapshot — a Product or ProductIdentifier can be
  // deleted in between. A Map lookup that drops the row (instead of a
  // non-null-asserted .find()!) means a race degrades that one candidate
  // out of the result set rather than throwing an uncaught TypeError that
  // would 500 the review-queue detail page or abort a whole sync run.
  const productById = new Map(products.map((p) => [p.id, p]));
  const identifierById = new Map(identifiers.map((i) => [i.id, i]));

  const candidates: MatchCandidate[] = [];
  for (const r of rows) {
    const product = productById.get(r.productId);
    const identifier = identifierById.get(r.identifierId);
    if (!product || !identifier) continue; // deleted mid-query — skip, don't throw
    candidates.push({ product, identifier, similarityScore: r.similarity });
  }
  return candidates;
}
