import { resolutionStep, type AgentStep } from "@/lib/domain/agent-steps";
import { applyGovernance, type Governance } from "@/lib/domain/governance";
import { runMatching, type MatchingResult } from "@/lib/domain/matching";
import type { AgentDecision, PoAmendmentLookup } from "@/lib/domain/resolution";
import {
  buildEvaluationTransaction,
  type EvalDatasetRow,
  type EvaluationTransaction,
} from "./build-evaluation-transaction";
import { evalDatasetRows, evalFixtureRows } from "./dataset.generated";
import { mockAgentStep } from "./mock-agent";
import { normalizeEvalAmendmentResponse } from "./normalize-amendment-response";

/** An eval dataset row run through the ported workflow, with the mock agent. */
export type EvalCase = EvaluationTransaction & {
  matchingResult: MatchingResult;
  toolLookup: PoAmendmentLookup;
  agentSteps: AgentStep[];
  /** The resolution step's output, as n8n calls it. */
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
  const matchingResult = runMatching(evaluation.transaction);
  const toolLookup = normalizeEvalAmendmentResponse(fixture);
  const agentSteps = [
    mockAgentStep(evaluation, toolLookup, {
      startedAt: clock.receivedAt,
      completedAt: clock.evaluatedAt,
    }),
  ];
  const agentDecision = resolutionStep(agentSteps, "PRICE_VARIANCE").output;
  return {
    ...evaluation,
    matchingResult,
    toolLookup,
    agentSteps,
    agentDecision,
    governance: applyGovernance(
      "PRICE_VARIANCE",
      agentSteps,
      clock.evaluatedAt,
    ),
  };
}

export function allEvalCases(
  clockFor?: (index: number) => EvalCaseClock,
): EvalCase[] {
  return evalDatasetRows.map((row, index) =>
    runEvalCase(row, evalFixtureRows, clockFor?.(index)),
  );
}
