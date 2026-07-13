import type { MatchCandidate, GuardrailResult } from "./types";

const SIMILARITY_WEIGHT = 0.8;
const BRAND_MATCH_WEIGHT = 0.2; // flat bonus — brand match is already a precondition here

/**
 * A forced-manual guardrail caps the score below the AUTO
 * threshold no matter how high the raw similarity is — the
 * guardrail always wins the argument with the string match.
 */
export function computeConfidence(
  candidate: MatchCandidate,
  guardrails: GuardrailResult
): number {
  let score = candidate.similarityScore * SIMILARITY_WEIGHT + BRAND_MATCH_WEIGHT;

  if (guardrails.forceManualReview) {
    score = Math.min(score, 0.89);
  }

  return Math.min(score, 1);
}
