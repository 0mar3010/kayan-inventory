import { prisma } from "@/lib/prisma";
import { normalizeIdentifier } from "./normalize";
import { matchRow, confirmMapping } from "./matcher.service";
import type { ExcelRow } from "./types";
import { MatchStatus, SourceSystem } from "@prisma/client";

export interface ReviewQueueSummary {
  id: string;
  syncRunId: string;
  rawModelNumber: string;
  brand: string;
  quantity: number;
  fileRowNumber: number;
  confidenceScore: number | null;
  matchedProductName: string | null;
}

export interface CandidateDTO {
  productId: string;
  arabicName: string;
  englishName: string | null;
  brand: string;
  imageUrl: string | null;
  category: string | null;
  rawExternalId: string; // the existing identifier this candidate was matched via
  similarityScore: number;
}

export interface ReviewItemDetail extends ReviewQueueSummary {
  status: MatchStatus;
  candidates: CandidateDTO[];
  guardrailReasons: string[];
  forceManualReview: boolean;
  oldQuantity: number | null; // last LOCAL_EXCEL snapshot for the top candidate
  newQuantity: number; // staged quantity from this Excel row
}

/**
 * Thrown when a caller tries to approve an item against a
 * productId that isn't one of the candidates actually surfaced
 * to the reviewer. Distinct from the generic conflict error so
 * the API route can map it to 400 (bad request) instead of 409
 * (conflict) — this is an invalid request, not a data conflict.
 */
export class InvalidCandidateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCandidateError";
  }
}

/** rawRowData is stored as ExcelRow-shaped JSON at ingestion time. */
function parseRow(rawRowData: unknown): ExcelRow {
  return rawRowData as ExcelRow;
}

/**
 * List items awaiting human review. Reads only the persisted
 * SyncRunItem — no live re-matching here. Must stay cheap even
 * with hundreds of pending rows, so the expensive re-match in
 * getReviewItemDetail() only runs for the one item someone opens.
 */
export async function listPendingReviewItems(syncRunId?: string): Promise<ReviewQueueSummary[]> {
  const items = await prisma.syncRunItem.findMany({
    where: {
      matchStatus: MatchStatus.MANUAL,
      approved: false,
      ...(syncRunId ? { syncRunId } : {}),
    },
    include: { matchedProduct: true },
    orderBy: { confidenceScore: "asc" }, // most uncertain first
  });

  return items.map((item) => {
    const row = parseRow(item.rawRowData);
    return {
      id: item.id,
      syncRunId: item.syncRunId,
      rawModelNumber: row.rawModelNumber,
      brand: row.brand,
      quantity: row.quantity,
      fileRowNumber: row.fileRowNumber,
      confidenceScore: item.confidenceScore,
      matchedProductName: item.matchedProduct?.englishName ?? item.matchedProduct?.arabicName ?? null,
    };
  });
}

/**
 * Detail view for one item — re-runs matchRow() live rather than
 * trusting the snapshot taken at ingestion time. Guardrails (the
 * quantity-jump check in particular) depend on current DB state,
 * so a reviewer should see what matchRow would decide right now,
 * not what it decided when the file was first uploaded.
 */
export async function getReviewItemDetail(itemId: string): Promise<ReviewItemDetail> {
  const item = await prisma.syncRunItem.findUniqueOrThrow({ where: { id: itemId } });
  const row = parseRow(item.rawRowData);

  const fresh = await matchRow(row);

  // Stock delta for the reviewer: the last LOCAL_EXCEL reading for the
  // top candidate (what stock this product currently shows) vs. the
  // quantity staged from this Excel row. Read-only — no snapshot is
  // written until the item is actually approved.
  const lastLocal = fresh.matchedProductId
    ? await prisma.inventorySnapshot.findFirst({
        where: { productId: fresh.matchedProductId, source: SourceSystem.LOCAL_EXCEL },
        orderBy: { recordedAt: "desc" },
      })
    : null;

  const candidates: CandidateDTO[] = fresh.candidates.map((c) => ({
    productId: c.product.id,
    arabicName: c.product.arabicName,
    englishName: c.product.englishName,
    brand: c.product.brand,
    imageUrl: c.product.imageUrl,
    category: c.product.category,
    rawExternalId: c.identifier.rawExternalId,
    similarityScore: c.similarityScore,
  }));

  return {
    id: item.id,
    syncRunId: item.syncRunId,
    rawModelNumber: row.rawModelNumber,
    brand: row.brand,
    quantity: row.quantity,
    fileRowNumber: row.fileRowNumber,
    confidenceScore: fresh.confidenceScore,
    matchedProductName: null,
    status: fresh.status,
    candidates,
    guardrailReasons: fresh.guardrails.reasons,
    forceManualReview: fresh.guardrails.forceManualReview,
    oldQuantity: lastLocal?.quantity ?? null,
    newQuantity: row.quantity,
  };
}

/**
 * Approve a review-queue item against a human-selected product
 * (defaults to the top candidate in the UI, but the reviewer can
 * pick a different one from the list). All three writes —
 * confirmMapping, the inventory snapshot, and the SyncRunItem
 * update — happen in one transaction. Without that, a crash
 * between steps could leave a confirmed identifier with no
 * matching snapshot, or an "approved" row with no confirmed
 * mapping — exactly the kind of silent half-state this system
 * is built to avoid.
 *
 * autoplan T1: selectedProductId is re-validated against candidates
 * re-derived server-side from the item's own rawRowData — never
 * trusted blindly from the caller. Without this, any caller who can
 * reach this endpoint could bind an arbitrary external id to an
 * arbitrary Product at confidence 1.0, permanently — worse than the
 * missing-auth gap alone, since it would also affect an authenticated
 * caller who fat-fingers or replays a stale request.
 */
export async function approveReviewItem(params: {
  itemId: string;
  selectedProductId: string;
  confirmedBy: string;
}) {
  const { itemId, selectedProductId, confirmedBy } = params;

  return prisma.$transaction(async (tx) => {
    const item = await tx.syncRunItem.findUniqueOrThrow({ where: { id: itemId } });

    if (item.approved) {
      throw new Error(`sync run item ${itemId} is already approved`);
    }

    const row = parseRow(item.rawRowData);
    const normalizedId = await normalizeIdentifier(row.rawModelNumber, row.brand);

    // autoplan T1: re-derive the candidates that would actually be shown to
    // a reviewer right now, and refuse to approve against anything else.
    const fresh = await matchRow(row);
    const candidateIds = new Set(fresh.candidates.map((c) => c.product.id));
    if (!candidateIds.has(selectedProductId)) {
      throw new InvalidCandidateError(
        `invalid_candidate: "${selectedProductId}" is not among the candidates surfaced for this item — refusing to approve`
      );
    }

    // Append-only — throws on a genuine conflict (this raw string
    // already confirmed against a different product). That error
    // is allowed to propagate and abort the whole transaction.
    await confirmMapping(
      {
        productId: selectedProductId,
        rawExternalId: row.rawModelNumber,
        normalizedId,
        source: SourceSystem.LOCAL_EXCEL,
        confidenceScore: 1.0, // human-confirmed, full confidence
        confirmedBy,
      },
      tx
    );

    await tx.inventorySnapshot.create({
      data: {
        productId: selectedProductId,
        source: SourceSystem.LOCAL_EXCEL,
        quantity: row.quantity,
      },
    });

    const updated = await tx.syncRunItem.update({
      where: { id: itemId },
      data: {
        matchedProductId: selectedProductId,
        approved: true,
        newQuantity: row.quantity,
      },
    });

    await tx.activityLog.create({
      data: {
        actorId: confirmedBy,
        action: "REVIEW_QUEUE_APPROVE",
        entityType: "SyncRunItem",
        entityId: itemId,
        before: { approved: item.approved, matchedProductId: item.matchedProductId },
        after: { approved: true, matchedProductId: selectedProductId },
      },
    });

    return updated;
  });
}

/**
 * Reject an item — a human has decided none of the candidates
 * are correct. Routes it to UNMATCHED: no product write, no
 * inventory write, stock stays untouched. Never silently deletes
 * the row; it stays visible in sync-run history as a resolved
 * non-match.
 */
export async function rejectReviewItem(params: {
  itemId: string;
  confirmedBy: string;
  reason?: string;
}) {
  const { itemId, confirmedBy, reason } = params;

  return prisma.$transaction(async (tx) => {
    const item = await tx.syncRunItem.findUniqueOrThrow({ where: { id: itemId } });

    if (item.approved) {
      throw new Error(`sync run item ${itemId} is already approved, cannot reject`);
    }

    const updated = await tx.syncRunItem.update({
      where: { id: itemId },
      data: {
        matchStatus: MatchStatus.UNMATCHED,
        matchedProductId: null,
      },
    });

    await tx.activityLog.create({
      data: {
        actorId: confirmedBy,
        action: "REVIEW_QUEUE_REJECT",
        entityType: "SyncRunItem",
        entityId: itemId,
        before: { matchStatus: item.matchStatus, matchedProductId: item.matchedProductId },
        after: { matchStatus: MatchStatus.UNMATCHED, matchedProductId: null, reason: reason ?? null },
      },
    });

    return updated;
  });
}
