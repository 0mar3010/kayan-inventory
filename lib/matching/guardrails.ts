import type { ExcelRow, MatchCandidate, GuardrailResult } from "./types";

/**
 * Non-negotiable checks above string similarity. A high
 * similarity score never overrides a failed or downgraded
 * guardrail — this is where correctness actually lives.
 */
export function applyGuardrails(
  row: ExcelRow,
  candidate: MatchCandidate,
  lastKnownQuantity: number | null
): GuardrailResult {
  const reasons: string[] = [];
  let forceManualReview = false;

  if (candidate.product.brand !== row.brand) {
    // Should be unreachable — findFuzzyCandidates already filters
    // by brand. Kept as defense-in-depth, never trusted alone.
    return { passed: false, reasons: ["brand_mismatch"], forceManualReview: true };
  }

  if (lastKnownQuantity !== null) {
    const jump = Math.abs(row.quantity - lastKnownQuantity);
    const relativeJump = lastKnownQuantity === 0 ? jump : jump / lastKnownQuantity;

    if (relativeJump > 5) {
      reasons.push("quantity_jump_over_5x");
      forceManualReview = true;
    }
  }

  return { passed: true, reasons, forceManualReview };
}
