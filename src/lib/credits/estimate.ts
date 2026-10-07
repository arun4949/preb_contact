import { CREDIT_COST } from "@/lib/fullenrich/mapping";

export type EnrichmentField = "work_email" | "personal_email" | "mobile_phone";

/** Find-rate weights for the "typical" estimate (F1). */
export const FIND_RATE: Record<EnrichmentField, number> = {
  work_email: 0.8,
  personal_email: 0.4,
  mobile_phone: 0.5,
};

export interface CreditEstimate {
  /** Find-rate weighted expectation — what we hold and require before start. */
  typical: number;
  /** Everything found on every row. */
  max: number;
  perRowMax: number;
}

export function estimateCredits(rows: number, fields: EnrichmentField[]): CreditEstimate {
  const perRowMax = fields.reduce((sum, f) => sum + CREDIT_COST[f], 0);
  const perRowTypical = fields.reduce((sum, f) => sum + CREDIT_COST[f] * FIND_RATE[f], 0);
  return {
    typical: Math.ceil(rows * perRowTypical),
    max: rows * perRowMax,
    perRowMax,
  };
}
