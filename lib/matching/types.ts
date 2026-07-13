import type { Product, ProductIdentifier, MatchStatus } from "@prisma/client";

export interface ExcelRow {
  rawModelNumber: string;
  brand: string;
  quantity: number;
  fileRowNumber: number;
}

export interface MatchCandidate {
  product: Product;
  identifier: ProductIdentifier;
  similarityScore: number; // raw trigram similarity, 0-1
}

export interface GuardrailResult {
  passed: boolean;
  reasons: string[];
  forceManualReview: boolean;
}

export interface MatchResult {
  status: MatchStatus; // AUTO | MANUAL | UNMATCHED
  matchedProductId: string | null;
  confidenceScore: number | null;
  candidates: MatchCandidate[]; // top candidates, for the review-queue UI
  normalizedId: string;
  guardrails: GuardrailResult; // why a row needs a human, not just its score
}

export const CONFIDENCE_THRESHOLDS = {
  AUTO: 0.9,
  MANUAL: 0.5,
} as const;
