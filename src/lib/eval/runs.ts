import { governanceCategorySchema } from "@/lib/domain/governance";
import {
  recommendedActionSchema,
  riskLevelSchema,
  rootCauseSchema,
  type PoAmendmentLookup,
} from "@/lib/domain/resolution";
import type { EvaluationMeta } from "@/lib/domain/evaluation";
import type { Transaction } from "@/lib/domain/transaction";
import {
  buildEvaluationTransaction,
  type EvalDatasetRow,
} from "./build-evaluation-transaction";
import { evalDatasetRows, evalFixtureRows } from "./dataset.generated";
import { evalRunExports } from "./runs.generated";
import { allEvalCases } from "./eval-cases";
import {
  aggregateMetrics,
  evaluationActualFrom,
  releaseGates,
  scoreEvaluationRow,
  type EvaluationActual,
  type EvaluationAggregates,
  type EvaluationMetrics,
  type ReleaseGate,
  type ScoredRow,
} from "./metrics";
import { normalizeEvalAmendmentResponse } from "./normalize-amendment-response";

// Evaluation results for the UI. There are two kinds of run, and they must
// never be confused:
//
// - MODEL_RUN: the actual* columns of an n8n evaluation run export. This is
//   the only source of model quality results.
// - SELF_TEST: the mock agent, which returns the answer key. It checks that
//   scoring, governance and release gates are wired correctly and says
//   nothing about model quality.

export type EvaluationRunRow = ScoredRow & {
  /** What the case fed the workflow, for the dataset and red-team views. */
  inputs: {
    transaction: Transaction;
    toolLookup: PoAmendmentLookup;
  };
  /** Stored n8n metric columns that disagree with the recomputed value. */
  metricDiscrepancies: MetricDiscrepancy[];
  evaluationRunAt: string | null;
};

export type MetricDiscrepancy = {
  metric: keyof EvaluationMetrics;
  stored: string;
  recomputed: 0 | 1;
};

export type EvaluationRun = {
  kind: "MODEL_RUN" | "SELF_TEST";
  label: string;
  description: string;
  rows: EvaluationRunRow[];
  aggregates: EvaluationAggregates;
  gates: ReleaseGate[];
};

export type EvaluationRunSlotId = "baseline" | "hardened";

export type EvaluationRunSlot = {
  id: EvaluationRunSlotId;
  label: string;
  description: string;
};

/** The named model runs the evaluation view compares, in order. */
export const EVALUATION_RUN_SLOTS: readonly EvaluationRunSlot[] = [
  {
    id: "baseline",
    label: "Baseline: current policy",
    description:
      "n8n evaluation run with the current Apply Resolution Risk Policy, which trusts the root cause asserted by the agent.",
  },
  {
    id: "hardened",
    label: "Hardened: evidence validation",
    description:
      "n8n evaluation run with deterministic evidence validation: the policy checks an independent PO amendment lookup before allowing automation.",
  },
];

export type ModelRunState =
  | { status: "NOT_IMPORTED" }
  | { status: "INCOMPLETE"; missingTestCaseIds: string[] }
  | { status: "MISMATCHED"; problems: string[] }
  | { status: "IMPORTED"; run: EvaluationRun };

export type NamedModelRun = { slot: EvaluationRunSlot; state: ModelRunState };

export const SELF_TEST_LABEL = "Scoring pipeline self-test";
export const SELF_TEST_DESCRIPTION =
  "The mock agent returns the dataset's expected answers, so every result here passes by construction. This checks that matching, governance, scoring and release gates are wired correctly. It is not a measure of model quality.";

const ACTUAL_COLUMNS = [
  "actualRootCause",
  "actualAction",
  "actualRiskLevel",
  "actualHumanReview",
  "actualAutomationAllowed",
  "actualGovernanceCategory",
  "actualEvidencePresent",
] as const;

const METRIC_COLUMNS: (keyof EvaluationMetrics)[] = [
  "rootCauseCorrect",
  "actionCorrect",
  "riskLevelCorrect",
  "humanReviewCorrect",
  "automationCorrect",
  "governanceCategoryCorrect",
  "evidencePresentCorrect",
  "forbiddenRootCauseTriggered",
  "forbiddenActionTriggered",
  "falseAutoResolution",
  "overallDecisionCorrect",
  "redTeamPassed",
];

function run(
  kind: EvaluationRun["kind"],
  label: string,
  description: string,
  rows: EvaluationRunRow[],
): EvaluationRun {
  return {
    kind,
    label,
    description,
    rows,
    aggregates: aggregateMetrics(rows),
    gates: releaseGates(rows),
  };
}

function inputsFor(row: EvalDatasetRow, fixtures: readonly EvalDatasetRow[]) {
  const fixture = fixtures.find((f) => f.fixtureKey === row.fixtureKey);
  if (!fixture)
    throw new Error(
      `Eval case ${row.testCaseId} references missing fixture ${row.fixtureKey}`,
    );
  return {
    evaluation: buildEvaluationTransaction(row),
    toolLookup: normalizeEvalAmendmentResponse(fixture),
  };
}

export type EvaluationCase = Pick<
  EvaluationRunRow,
  "meta" | "expected" | "inputs"
>;

/** The dataset's cases, independent of any run: for the dataset and red-team views. */
export function evaluationCases(
  datasetRows: readonly EvalDatasetRow[] = evalDatasetRows,
  fixtures: readonly EvalDatasetRow[] = evalFixtureRows,
): EvaluationCase[] {
  return datasetRows.map((row) => {
    const { evaluation, toolLookup } = inputsFor(row, fixtures);
    return {
      meta: evaluation.evaluationMeta,
      expected: evaluation.evaluationExpected,
      inputs: { transaction: evaluation.transaction, toolLookup },
    };
  });
}

export function selfTestRun(): EvaluationRun {
  const rows = allEvalCases().map((c): EvaluationRunRow => {
    const actual = evaluationActualFrom(c.agentDecision, c.governance);
    return {
      meta: c.evaluationMeta,
      expected: c.evaluationExpected,
      actual,
      metrics: scoreEvaluationRow(
        c.evaluationExpected,
        actual,
        c.evaluationMeta.suite,
      ),
      inputs: { transaction: c.transaction, toolLookup: c.toolLookup },
      metricDiscrepancies: [],
      evaluationRunAt: null,
    };
  });
  return run("SELF_TEST", SELF_TEST_LABEL, SELF_TEST_DESCRIPTION, rows);
}

const toBoolean = (value: string) => value.trim().toLowerCase() === "true";

/** Columns of the dataset that describe the case, not the run's results. */
const INPUT_COLUMNS = [
  "suite",
  "scenario",
  "fixtureKey",
  "invoiceId",
  "supplierName",
  "poNumber",
  "invoiceUnitPrice",
  "poUnitPrice",
  "invoiceCurrency",
  "poCurrency",
  "priceTolerancePct",
  "expectedRootCause",
  "expectedAction",
  "expectedRiskLevel",
  "expectedHumanReview",
  "expectedAutomationAllowed",
  "expectedGovernanceCategory",
  "expectedEvidencePresent",
  "forbiddenRootCause",
  "forbiddenAction",
] as const;

/**
 * Reads a model run from an n8n evaluation data table export. Only the
 * actual* columns and evaluationRunAt are taken from the export: inputs and
 * expected outcomes come from the dataset, and an export that disagrees with
 * the dataset is reported as mismatched. Metrics are recomputed with the
 * ported node; stored metric columns that disagree (or are not 0/1) are
 * reported, not trusted.
 */
export function modelRunFromExport(
  slot: EvaluationRunSlot,
  exportRows: readonly EvalDatasetRow[] | null,
  datasetRows: readonly EvalDatasetRow[] = evalDatasetRows,
  fixtures: readonly EvalDatasetRow[] = evalFixtureRows,
): ModelRunState {
  if (!exportRows) return { status: "NOT_IMPORTED" };

  const problems: string[] = [];
  const exportIds = exportRows.map((r) => r.testCaseId);
  const datasetIds = datasetRows.map((r) => r.testCaseId);
  for (const id of datasetIds.filter((id) => !exportIds.includes(id))) {
    problems.push(`${id} is in the dataset but not in the export.`);
  }
  for (const id of exportIds.filter((id) => !datasetIds.includes(id))) {
    problems.push(`${id} is in the export but not in the dataset.`);
  }
  for (const datasetRow of datasetRows) {
    const exported = exportRows.find(
      (r) => r.testCaseId === datasetRow.testCaseId,
    );
    if (!exported) continue;
    for (const column of INPUT_COLUMNS) {
      if ((exported[column] ?? "") !== datasetRow[column]) {
        problems.push(
          `${datasetRow.testCaseId}: ${column} is "${exported[column] ?? ""}" in the export but "${datasetRow[column]}" in the dataset.`,
        );
      }
    }
  }
  if (problems.length > 0) return { status: "MISMATCHED", problems };

  const hasActuals = (row: EvalDatasetRow) =>
    ACTUAL_COLUMNS.every((c) => (row[c] ?? "").trim() !== "");
  const missing = datasetRows.filter(
    (row) =>
      !hasActuals(exportRows.find((r) => r.testCaseId === row.testCaseId)!),
  );
  if (missing.length > 0) {
    return {
      status: "INCOMPLETE",
      missingTestCaseIds: missing.map((r) => r.testCaseId),
    };
  }

  const rows = datasetRows.map((datasetRow): EvaluationRunRow => {
    const exported = exportRows.find(
      (r) => r.testCaseId === datasetRow.testCaseId,
    )!;
    const { evaluation, toolLookup } = inputsFor(datasetRow, fixtures);
    const actual: EvaluationActual = {
      rootCause: rootCauseSchema.parse(exported.actualRootCause.trim()),
      recommendedAction: recommendedActionSchema.parse(
        exported.actualAction.trim(),
      ),
      riskLevel: riskLevelSchema.parse(exported.actualRiskLevel.trim()),
      requiresHumanReview: toBoolean(exported.actualHumanReview),
      automationAllowed: toBoolean(exported.actualAutomationAllowed),
      governanceCategory: governanceCategorySchema.parse(
        exported.actualGovernanceCategory.trim(),
      ),
      evidencePresent: toBoolean(exported.actualEvidencePresent),
    };
    const metrics = scoreEvaluationRow(
      evaluation.evaluationExpected,
      actual,
      evaluation.evaluationMeta.suite,
    );
    const metricDiscrepancies = METRIC_COLUMNS.flatMap(
      (metric): MetricDiscrepancy[] => {
        const stored = (exported[metric] ?? "").trim();
        if (stored === "") return [];
        return stored === String(metrics[metric])
          ? []
          : [{ metric, stored, recomputed: metrics[metric] }];
      },
    );
    return {
      meta: evaluation.evaluationMeta,
      expected: evaluation.evaluationExpected,
      actual,
      metrics,
      inputs: { transaction: evaluation.transaction, toolLookup },
      metricDiscrepancies,
      evaluationRunAt: exported.evaluationRunAt?.trim() || null,
    };
  });

  return {
    status: "IMPORTED",
    run: run("MODEL_RUN", slot.label, slot.description, rows),
  };
}

export function modelRuns(
  exports: Readonly<
    Record<EvaluationRunSlotId, readonly EvalDatasetRow[] | null>
  > = evalRunExports,
): NamedModelRun[] {
  return EVALUATION_RUN_SLOTS.map((slot) => ({
    slot,
    state: modelRunFromExport(slot, exports[slot.id]),
  }));
}

// --- Before / after comparison ------------------------------------------------------

export type GateComparison = {
  id: string;
  label: string;
  threshold: string;
  before: ReleaseGate;
  after: ReleaseGate;
};

export type RowComparison = {
  testCaseId: string;
  suite: EvaluationMeta["suite"];
  scenario: string;
  expected: Pick<EvaluationActual, "automationAllowed" | "governanceCategory">;
  before: Pick<EvaluationActual, "automationAllowed" | "governanceCategory"> & {
    falseAutoResolution: 0 | 1;
    overallDecisionCorrect: 0 | 1;
  };
  after: RowComparison["before"];
  changed: boolean;
};

export type RunComparison = { gates: GateComparison[]; rows: RowComparison[] };

/** Lines up two runs of the same dataset, gate by gate and case by case. */
export function compareRuns(
  before: EvaluationRun,
  after: EvaluationRun,
): RunComparison {
  const gates = before.gates.map((gate) => {
    const match = after.gates.find((g) => g.id === gate.id)!;
    return {
      id: gate.id,
      label: gate.label,
      threshold: gate.threshold,
      before: gate,
      after: match,
    };
  });
  const summary = (row: EvaluationRunRow) => ({
    automationAllowed: row.actual.automationAllowed,
    governanceCategory: row.actual.governanceCategory,
    falseAutoResolution: row.metrics.falseAutoResolution,
    overallDecisionCorrect: row.metrics.overallDecisionCorrect,
  });
  const rows = before.rows.map((row) => {
    const other = after.rows.find(
      (r) => r.meta.testCaseId === row.meta.testCaseId,
    )!;
    const b = summary(row);
    const a = summary(other);
    return {
      testCaseId: row.meta.testCaseId,
      suite: row.meta.suite,
      scenario: row.meta.scenario,
      expected: {
        automationAllowed: row.expected.automationAllowed,
        governanceCategory: row.expected.governanceCategory,
      },
      before: b,
      after: a,
      changed: JSON.stringify(a) !== JSON.stringify(b),
    };
  });
  return { gates, rows };
}
