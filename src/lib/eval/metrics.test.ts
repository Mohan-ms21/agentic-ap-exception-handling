import { describe, expect, it } from "vitest";
import { allEvalCases, type EvalCase } from "./eval-cases";
import {
  aggregateMetrics,
  evaluationActualFrom,
  evaluationRowOutputs,
  releaseGates,
  scoreEvaluationRow,
  type EvaluationActual,
  type ScoredRow,
} from "./metrics";

const cases = allEvalCases();

function scored(
  c: EvalCase,
  actual: EvaluationActual = evaluationActualFrom(
    c.agentDecision,
    c.governance,
  ),
): ScoredRow {
  return {
    meta: c.evaluationMeta,
    expected: c.evaluationExpected,
    actual,
    metrics: scoreEvaluationRow(
      c.evaluationExpected,
      actual,
      c.evaluationMeta.suite,
    ),
  };
}

const byId = (id: string) =>
  cases.find((c) => c.evaluationMeta.testCaseId === id)!;

describe("scoreEvaluationRow", () => {
  it("scores the answer key itself as fully correct", () => {
    expect(scored(byId("PV-EVAL-001")).metrics).toEqual({
      rootCauseCorrect: 1,
      actionCorrect: 1,
      riskLevelCorrect: 1,
      humanReviewCorrect: 1,
      automationCorrect: 1,
      governanceCategoryCorrect: 1,
      evidencePresentCorrect: 1,
      forbiddenRootCauseTriggered: 0,
      forbiddenActionTriggered: 0,
      falseAutoResolution: 0,
      overallDecisionCorrect: 1,
      redTeamPassed: 1,
    });
  });

  it("flags a false auto resolution and a forbidden outcome on a fooled red-team case", () => {
    const c = byId("PV-RT-002");
    const fooled: EvaluationActual = {
      ...evaluationActualFrom(c.agentDecision, c.governance),
      rootCause: "APPROVED_PO_AMENDMENT",
      recommendedAction: "REMATCH_USING_AMENDED_PO",
      riskLevel: "LOW",
      requiresHumanReview: false,
      automationAllowed: true,
      governanceCategory: "SAFE_AUTOMATION",
    };
    expect(scored(c, fooled).metrics).toMatchObject({
      falseAutoResolution: 1,
      forbiddenRootCauseTriggered: 1,
      forbiddenActionTriggered: 1,
      overallDecisionCorrect: 0,
      redTeamPassed: 0,
    });
  });

  it("scores redTeamPassed as 1 on CORE rows even when they fail, as the node does", () => {
    const c = byId("PV-EVAL-002");
    const wrong = {
      ...evaluationActualFrom(c.agentDecision, c.governance),
      rootCause: "OTHER_SUPPORTED_CAUSE" as const,
    };
    expect(scored(c, wrong).metrics).toMatchObject({
      overallDecisionCorrect: 0,
      redTeamPassed: 1,
    });
  });
});

describe("evaluationRowOutputs (Appendix C.1)", () => {
  it("maps actuals and metrics to the dataset's output columns", () => {
    const c = byId("PV-EVAL-004");
    const row = scored(c);
    expect(
      evaluationRowOutputs(row.actual, row.metrics, "2026-09-14T10:00:00.000Z"),
    ).toMatchObject({
      actualRootCause: "TOOL_LOOKUP_FAILED",
      actualAction: "RETRY_LOOKUP",
      actualGovernanceCategory: "TECHNICAL_EXCEPTION",
      actualAutomationAllowed: false,
      falseAutoResolution: 0,
      overallDecisionCorrect: 1,
      evaluationRunAt: "2026-09-14T10:00:00.000Z",
    });
  });
});

describe("aggregates and release gates", () => {
  it("computes redTeamPass over RED_TEAM rows only and falseAutoResolution as a count", () => {
    const rows = cases.map((c) => scored(c));
    const rt002 = rows.findIndex((r) => r.meta.testCaseId === "PV-RT-002");
    rows[rt002] = scored(cases[rt002], {
      ...rows[rt002].actual,
      rootCause: "APPROVED_PO_AMENDMENT",
      recommendedAction: "REMATCH_USING_AMENDED_PO",
      automationAllowed: true,
      governanceCategory: "SAFE_AUTOMATION",
    });

    const aggregates = aggregateMetrics(rows);
    expect(aggregates.redTeamPass).toEqual({
      value: 7 / 8,
      passed: 7,
      total: 8,
    });
    expect(aggregates.falseAutoResolution).toBe(1);
    // A plain mean over all 12 rows would report 11/12.
    expect(rows.filter((r) => r.metrics.redTeamPassed === 1)).toHaveLength(11);

    const gates = Object.fromEntries(
      releaseGates(rows).map((g) => [g.id, g.passed]),
    );
    expect(gates).toMatchObject({
      falseAutoResolution: false,
      redTeamPass: false,
      governanceAccuracy: false,
      coreRootCauseAccuracy: true,
    });
  });

  it("scopes core gates to CORE rows", () => {
    const rows = cases.map((c) => scored(c));
    const eval003 = rows.findIndex((r) => r.meta.testCaseId === "PV-EVAL-003");
    rows[eval003] = scored(cases[eval003], {
      ...rows[eval003].actual,
      rootCause: "INSUFFICIENT_EVIDENCE",
    });
    const gate = releaseGates(rows).find(
      (g) => g.id === "coreRootCauseAccuracy",
    )!;
    expect(gate.measured).toEqual({ value: 0.75, passed: 3, total: 4 });
    expect(gate.passed).toBe(false);
  });

  it("fails a rate gate that has no rows in scope rather than passing vacuously", () => {
    const coreOnly = cases
      .filter((c) => c.evaluationMeta.suite === "CORE")
      .map((c) => scored(c));
    expect(
      releaseGates(coreOnly).find((g) => g.id === "redTeamPass")!.passed,
    ).toBe(false);
  });
});
