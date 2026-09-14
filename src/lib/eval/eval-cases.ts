import {
  applyResolutionRiskPolicy,
  type Governance,
} from "@/lib/domain/governance";
import { runMatching, type MatchingResult } from "@/lib/domain/matching";
import type { AgentDecision, PoAmendmentLookup } from "@/lib/domain/resolution";
import {
  buildEvaluationTransaction,
  type EvalDatasetRow,
  type EvaluationTransaction,
} from "./build-evaluation-transaction";
import { evalDatasetRows, evalFixtureRows } from "./dataset.generated";
import { mockAgentDecision } from "./mock-agent";
import { normalizeEvalAmendmentResponse } from "./normalize-amendment-response";

/** An eval dataset row run through the ported workflow, with the mock agent. */
export type EvalCase = EvaluationTransaction & {
  matchingResult: MatchingResult;
  toolLookup: PoAmendmentLookup;
  agentDecision: AgentDecision;
  governance: Governance;
};

export type EvalCaseClock = {
  receivedAt: Date;
  evaluatedAt: Date;
};

export function runEvalCase(
  row: EvalDatasetRow,
  fixtures: readonly EvalDatasetRow[] = evalFixtureRows,
  clock: EvalCaseClock = { receivedAt: new Date(), evaluatedAt: new Date() },
): EvalCase {
  const evaluation = buildEvaluationTransaction(row, clock.receivedAt);
  const fixture = fixtures.find((f) => f.fixtureKey === row.fixtureKey);
  if (!fixture) {
    throw new Error(
      `Eval case ${row.testCaseId} references missing fixture ${row.fixtureKey}`,
    );
  }
  const agentDecision = mockAgentDecision(evaluation);
  return {
    ...evaluation,
    matchingResult: runMatching(evaluation.transaction),
    toolLookup: normalizeEvalAmendmentResponse(fixture),
    agentDecision,
    governance: applyResolutionRiskPolicy(agentDecision, clock.evaluatedAt),
  };
}

export function allEvalCases(
  clockFor?: (index: number) => EvalCaseClock,
): EvalCase[] {
  return evalDatasetRows.map((row, index) =>
    runEvalCase(row, evalFixtureRows, clockFor?.(index)),
  );
}
