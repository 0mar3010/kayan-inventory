import { prisma } from "@/lib/prisma";
import { normalizeIdentifier } from "./normalize";
import { findExactMatch, findFuzzyCandidates } from "./candidates";
import { applyGuardrails } from "./guardrails";
import { computeConfidence } from "./confidence";
import { CONFIDENCE_THRESHOLDS } from "./types";
import type { ExcelRow, MatchResult } from "./types";
import { MatchStatus, SourceSystem, type Prisma } from "@prisma/client";

type DbClient = typeof prisma | Prisma.TransactionClient;

/**
 * Full matching pipeline for one Excel row. Pure read/decide —
 * never writes to Product/ProductIdentifier. Writes only ever
 * happen through confirmMapping() below, kept separate on
 * purpose so a bug in scoring can't silently corrupt the
 * crosswalk table.
 */
export async function matchRow(row: ExcelRow): Promise<MatchResult> {
  const normalizedId = await normalizeIdentifier(row.rawModelNumber, row.brand);

  const exact = await findExactMatch(normalizedId, SourceSystem.LOCAL_EXCEL);
  if (exact) {
    return {
      status: MatchStatus.AUTO,
      matchedProductId: exact.productId,
      confidenceScore: 1.0,
      candidates: [],
      normalizedId,
      guardrails: { passed: true, reasons: [], forceManualReview: false },
    };
  }

  const candidates = await findFuzzyCandidates(normalizedId, row.brand);
  if (candidates.length === 0) {
    return {
      status: MatchStatus.UNMATCHED,
      matchedProductId: null,
      confidenceScore: null,
      candidates: [],
      normalizedId,
      guardrails: { passed: true, reasons: [], forceManualReview: false },
    };
  }

  const [top, runnerUp] = candidates;

  // Ambiguity guard: near-tied top two always go manual,
  // regardless of how high the top score is on its own.
  const isAmbiguous = Boolean(runnerUp) && top.similarityScore - runnerUp.similarityScore < 0.05;

  const lastSnapshot = await prisma.inventorySnapshot.findFirst({
    where: { productId: top.product.id, source: SourceSystem.LOCAL_EXCEL },
    orderBy: { recordedAt: "desc" },
  });

  const guardrails = applyGuardrails(row, top, lastSnapshot?.quantity ?? null);
  const confidence = computeConfidence(top, guardrails);

  let status: MatchStatus;
  if (confidence < CONFIDENCE_THRESHOLDS.MANUAL) {
    status = MatchStatus.UNMATCHED;
  } else if (isAmbiguous || confidence < CONFIDENCE_THRESHOLDS.AUTO) {
    status = MatchStatus.MANUAL;
  } else {
    status = MatchStatus.AUTO;
  }

  return {
    status,
    matchedProductId: status === MatchStatus.UNMATCHED ? null : top.product.id,
    confidenceScore: confidence,
    candidates,
    normalizedId,
    guardrails,
  };
}

/**
 * Persist a human-confirmed (or genuinely auto-qualified)
 * mapping. Append-only by design: refuses to silently overwrite
 * an existing confirmed identifier for the same raw string,
 * since that would hide a real data conflict rather than
 * resolve it.
 */
export async function confirmMapping(
  params: {
    productId: string;
    rawExternalId: string;
    normalizedId: string;
    source: SourceSystem;
    confidenceScore: number;
    confirmedBy: string;
  },
  db: DbClient = prisma
) {
  const existing = await db.productIdentifier.findFirst({
    where: { source: params.source, rawExternalId: params.rawExternalId },
  });

  if (existing && existing.productId !== params.productId) {
    throw new Error(
      `conflict: "${params.rawExternalId}" already mapped to a different product — resolve manually, do not overwrite`
    );
  }

  if (existing) return existing; // already confirmed, no-op

  return db.productIdentifier.create({
    data: {
      productId: params.productId,
      source: params.source,
      rawExternalId: params.rawExternalId,
      normalizedId: params.normalizedId,
      confidenceScore: params.confidenceScore,
      confirmedBy: params.confirmedBy,
      confirmedAt: new Date(),
    },
  });
}
