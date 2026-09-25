import { RiskLevel } from './rule-engine';

export type MlStatus =
  | 'NOT_READY'
  | 'READY'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'ERROR'
  | 'MALFORMED_RESPONSE'
  | 'INVALID_PREDICTION'
  | 'INVALID_PROBABILITIES';

export type DecidedBy = 'RULE_ENGINE' | 'AGREEMENT' | 'ML_ESCALATION';

export interface MlResult {
  status: MlStatus;
  modelVersion?: string;
  prediction?: RiskLevel;
  confidence?: number;
  probabilities?: { LOW: number; MEDIUM: number; HIGH: number };
}

export interface HybridDecisionResult {
  riskLevel: RiskLevel;
  decidedBy: DecidedBy;
  ml: MlResult;
}

const SEVERITY: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

export function makeHybridDecision(
  ruleBasedLevel: RiskLevel,
  ml: MlResult,
): HybridDecisionResult {
  if (ml.status !== 'READY' || !ml.prediction) {
    return { riskLevel: ruleBasedLevel, decidedBy: 'RULE_ENGINE', ml };
  }

  if (ruleBasedLevel === ml.prediction) {
    return { riskLevel: ruleBasedLevel, decidedBy: 'AGREEMENT', ml };
  }

  if (SEVERITY[ml.prediction] > SEVERITY[ruleBasedLevel]) {
    return { riskLevel: ml.prediction, decidedBy: 'ML_ESCALATION', ml };
  }

  return { riskLevel: ruleBasedLevel, decidedBy: 'RULE_ENGINE', ml };
}
