import { prisma } from "@/lib/prisma";
import { matchRow, confirmMapping } from "@/lib/matching/matcher.service";
import type { ParsedRow } from "./parse-excel";
import { MatchStatus, SourceSystem, SyncRunStatus, Prisma } from "@prisma/client";

export interface IngestSummary {
  syncRunId: string;
  total: number;
  autoApplied: number; // exact cross-source match, stock written immediately
  needsReview: number; // fuzzy / ambiguous, sitting in the review queue
  unmatched: number; // no confident candidate, left untouched
}

/**
 * Ingest one parsed stock sheet: run every row through matchRow(), stage a
 * SyncRunItem for each, and — only for exact (confidence 1.0) matches —
 * auto-apply the stock write. Everything less certain lands in the review
 * queue for a human. Nothing here can silently overwrite the wrong product:
 * a fuzzy/ambiguous row never writes on its own.
 */
export async function ingestStockSheet(
  fileName: string,
  rows: ParsedRow[],
  triggeredBy: string
): Promise<IngestSummary> {
  const run = await prisma.syncRun.create({
    data: {
      fileName,
      status: SyncRunStatus.RUNNING,
      rowsTotal: rows.length,
      triggeredBy,
    },
  });

  let autoApplied = 0;
  let needsReview = 0;
  let unmatched = 0;

  for (const row of rows) {
    const result = await matchRow(row);

    // Exact normalized match against the catalog (same model, same brand):
    // safe to apply without review. Anything else — including fuzzy matches
    // the engine would call AUTO — is routed to manual review instead.
    const isExact = result.status === MatchStatus.AUTO && result.confidenceScore === 1;

    const oldQuantity = result.matchedProductId
      ? (
          await prisma.inventorySnapshot.findFirst({
            where: { productId: result.matchedProductId, source: SourceSystem.LOCAL_EXCEL },
            orderBy: { recordedAt: "desc" },
          })
        )?.quantity ?? null
      : null;

    if (isExact && result.matchedProductId) {
      await prisma.$transaction(async (tx) => {
        await confirmMapping(
          {
            productId: result.matchedProductId!,
            rawExternalId: row.rawModelNumber,
            normalizedId: result.normalizedId,
            source: SourceSystem.LOCAL_EXCEL,
            confidenceScore: 1.0,
            confirmedBy: triggeredBy,
          },
          tx
        );
        await tx.inventorySnapshot.create({
          data: {
            productId: result.matchedProductId!,
            source: SourceSystem.LOCAL_EXCEL,
            quantity: row.quantity,
          },
        });
        await tx.syncRunItem.create({
          data: {
            syncRunId: run.id,
            rawRowData: row as unknown as Prisma.InputJsonValue,
            matchStatus: MatchStatus.AUTO,
            matchedProductId: result.matchedProductId,
            confidenceScore: result.confidenceScore,
            oldQuantity,
            newQuantity: row.quantity,
            approved: true,
          },
        });
      });
      autoApplied++;
      continue;
    }

    // Downgrade a non-exact AUTO to MANUAL so it gets a human look.
    const status = result.status === MatchStatus.UNMATCHED ? MatchStatus.UNMATCHED : MatchStatus.MANUAL;

    await prisma.syncRunItem.create({
      data: {
        syncRunId: run.id,
        rawRowData: row as unknown as Prisma.InputJsonValue,
        matchStatus: status,
        matchedProductId: status === MatchStatus.UNMATCHED ? null : result.matchedProductId,
        confidenceScore: result.confidenceScore,
        oldQuantity,
        newQuantity: row.quantity,
        approved: false,
      },
    });

    if (status === MatchStatus.MANUAL) needsReview++;
    else unmatched++;
  }

  await prisma.syncRun.update({
    where: { id: run.id },
    data: {
      status: needsReview > 0 ? SyncRunStatus.AWAITING_APPROVAL : SyncRunStatus.COMPLETED,
      finishedAt: new Date(),
      rowsAutoMatched: autoApplied,
      rowsFlagged: needsReview,
    },
  });

  return { syncRunId: run.id, total: rows.length, autoApplied, needsReview, unmatched };
}
