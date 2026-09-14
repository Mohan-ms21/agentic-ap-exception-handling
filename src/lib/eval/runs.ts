import { governanceCategorySchema } from "@/lib/domain/governance";
import {
  recommendedActionSchema,
  riskLevelSchema,
  rootCauseSchema,
  type PoAmendmentLookup,
} from "@/lib/domain/resolution";
import type { Transaction } from "@/lib/domain/transaction";
import {
  buildEvaluationTransaction,
  type EvalDatasetRow,
} from "./build-evaluation-transaction";
import { evalDatasetRows, evalFixtureRows } from "./dataset.generated";
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

export type ModelRunState =
  | { status: "NOT_IMPORTED" }
  | { status: "INCOMPLETE"; missingTestCaseIds: string[] }
  | { status: "IMPORTED"; run: EvaluationRun };

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

/**
 * Reads a model run from the dataset export's actual* columns. Metrics are
 * recomputed with the ported node rather than read from the stored metric
 * columns; stored values that disagree (or are not 0/1) are reported, not
 * trusted.
 */
export function modelRunFromDataset(
  datasetRows: readonly EvalDatasetRow[] = evalDatasetRows,
  fixtures: readonly EvalDatasetRow[] = evalFixtureRows,
): ModelRunState {
  const hasActuals = (row: EvalDatasetRow) =>
    ACTUAL_COLUMNS.every((c) => (row[c] ?? "").trim() !== "");
  const filled = datasetRows.filter(hasActuals);
  if (filled.length === 0) return { status: "NOT_IMPORTED" };
  if (filled.length < datasetRows.length) {
    return {
      status: "INCOMPLETE",
      missingTestCaseIds: datasetRows
        .filter((r) => !hasActuals(r))
        .map((r) => r.testCaseId),
    };
  }

  const rows = datasetRows.map((row): EvaluationRunRow => {
    const { evaluation, toolLookup } = inputsFor(row, fixtures);
    const actual: EvaluationActual = {
      rootCause: rootCauseSchema.parse(row.actualRootCause.trim()),
      recommendedAction: recommendedActionSchema.parse(row.actualAction.trim()),
      riskLevel: riskLevelSchema.parse(row.actualRiskLevel.trim()),
      requiresHumanReview: toBoolean(row.actualHumanReview),
      automationAllowed: toBoolean(row.actualAutomationAllowed),
      governanceCategory: governanceCategorySchema.parse(
        row.actualGovernanceCategory.trim(),
      ),
      evidencePresent: toBoolean(row.actualEvidencePresent),
    };
    const metrics = scoreEvaluationRow(
      evaluation.evaluationExpected,
      actual,
      evaluation.evaluationMeta.suite,
    );
    const metricDiscrepancies = METRIC_COLUMNS.flatMap(
      (metric): MetricDiscrepancy[] => {
        const stored = (row[metric] ?? "").trim();
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
      evaluationRunAt: row.evaluationRunAt?.trim() || null,
    };
  });

  return {
    status: "IMPORTED",
    run: run(
      "MODEL_RUN",
      "n8n evaluation run",
      "Agent results recorded by an n8n evaluation run of the AP Invoice processing workflow, rescored with the ported metrics.",
      rows,
    ),
  };
}
