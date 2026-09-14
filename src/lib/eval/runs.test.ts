import { describe, expect, it } from "vitest";
import { evalDatasetRows } from "./dataset.generated";
import { allEvalCases } from "./eval-cases";
import {
  modelRunFromDataset,
  selfTestRun,
  SELF_TEST_DESCRIPTION,
} from "./runs";

/** A synthetic export: the answer key as actuals, as a perfect run would write. */
function exportedRows(
  overrides: Record<string, Record<string, string>> = {},
): Record<string, string>[] {
  const cases = allEvalCases();
  return evalDatasetRows.map((row) => {
    const c = cases.find(
      (x) => x.evaluationMeta.testCaseId === row.testCaseId,
    )!;
    return {
      ...row,
      actualRootCause: c.agentDecision.rootCause,
      actualAction: c.agentDecision.recommendedAction,
      actualRiskLevel: c.agentDecision.riskLevel,
      actualHumanReview: String(c.agentDecision.requiresHumanReview),
      actualAutomationAllowed: String(c.governance.automationAllowed),
      actualGovernanceCategory: c.governance.governanceCategory,
      actualEvidencePresent: "true",
      rootCauseCorrect: "1",
      // As written by the n8n Set Outputs node, whose mapping for this column
      // lacks the "=" expression prefix.
      overallDecisionCorrect:
        "{{ $json.evaluationMetrics.overallDecisionCorrect }}",
      evaluationRunAt: "2026-09-15T08:00:00.000+10:00",
      ...overrides[row.testCaseId],
    };
  });
}

describe("self-test run", () => {
  const run = selfTestRun();

  it("is labelled as a self-test, never as a model result", () => {
    expect(run.kind).toBe("SELF_TEST");
    expect(run.label).toBe("Scoring pipeline self-test");
    expect(SELF_TEST_DESCRIPTION).toMatch(/not a measure of model quality/);
  });

  it("passes every release gate by construction, with zero false auto resolutions", () => {
    expect(run.rows).toHaveLength(12);
    expect(run.aggregates.falseAutoResolution).toBe(0);
    expect(run.gates.every((g) => g.passed)).toBe(true);
  });

  it("carries the red-team inputs the UI shows", () => {
    const rt002 = run.rows.find((r) => r.meta.testCaseId === "PV-RT-002")!;
    expect(rt002.meta.attackDescription).toMatch(/malicious instructions/);
    expect(rt002.inputs.toolLookup).toMatchObject({
      lookupStatus: "FOUND",
      amendment: { status: "PENDING" },
    });
  });
});

describe("model run from the dataset export", () => {
  it("reports no model run while the actual* columns are empty (current dataset)", () => {
    expect(modelRunFromDataset()).toEqual({ status: "NOT_IMPORTED" });
  });

  it("reports an incomplete run when some rows have no actuals", () => {
    const rows = exportedRows().map((row) =>
      row.testCaseId === "PV-RT-005" ? { ...row, actualRootCause: "" } : row,
    );
    expect(modelRunFromDataset(rows)).toEqual({
      status: "INCOMPLETE",
      missingTestCaseIds: ["PV-RT-005"],
    });
  });

  it("rescores an imported run and flags stored metric columns it cannot trust", () => {
    const state = modelRunFromDataset(exportedRows());
    expect(state.status).toBe("IMPORTED");
    if (state.status !== "IMPORTED") return;

    expect(state.run.kind).toBe("MODEL_RUN");
    expect(state.run.aggregates.falseAutoResolution).toBe(0);
    for (const row of state.run.rows) {
      expect(row.metrics.overallDecisionCorrect).toBe(1);
      expect(row.metricDiscrepancies).toEqual([
        {
          metric: "overallDecisionCorrect",
          stored: "{{ $json.evaluationMetrics.overallDecisionCorrect }}",
          recomputed: 1,
        },
      ]);
      expect(row.evaluationRunAt).toBe("2026-09-15T08:00:00.000+10:00");
    }
  });

  it("surfaces a false auto resolution from the model's actual output", () => {
    const state = modelRunFromDataset(
      exportedRows({
        "PV-RT-002": {
          actualRootCause: "APPROVED_PO_AMENDMENT",
          actualAction: "REMATCH_USING_AMENDED_PO",
          actualRiskLevel: "LOW",
          actualHumanReview: "false",
          actualAutomationAllowed: "true",
          actualGovernanceCategory: "SAFE_AUTOMATION",
          rootCauseCorrect: "0",
        },
      }),
    );
    if (state.status !== "IMPORTED") throw new Error(state.status);
    expect(state.run.aggregates.falseAutoResolution).toBe(1);
    expect(
      state.run.gates.find((g) => g.id === "falseAutoResolution")?.passed,
    ).toBe(false);
    expect(state.run.aggregates.redTeamPass).toMatchObject({
      passed: 7,
      total: 8,
    });
  });

  it("rejects actual values outside the output schema", () => {
    expect(() =>
      modelRunFromDataset(
        exportedRows({ "PV-EVAL-001": { actualRootCause: "PAID" } }),
      ),
    ).toThrow();
  });
});
