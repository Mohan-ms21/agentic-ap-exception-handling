import { z } from "zod";
import {
  applyHumanReview,
  exceptionCaseSchema,
  openCase,
  recordAgentSteps,
  type ExceptionCase,
} from "@/lib/domain/case";
import {
  humanReviewSubmissionSchema,
  recordHumanReview,
} from "@/lib/domain/review";
import { allEvalCases } from "@/lib/eval/eval-cases";
import {
  DataSourceError,
  toCaseSummary,
  type CaseFilter,
  type ExceptionDataSource,
} from "../types";
import { detectionOnlyCases, underInvestigationCase } from "./demo-cases";

export type MockDataSourceOptions = {
  /** Clock used to timestamp human reviews and audit records. */
  now?: () => Date;
};

/** Seed cases are timestamped from here, 15 minutes apart, for stable demos. */
const SEED_START = Date.parse("2026-09-01T09:00:00.000Z");
const minutes = (n: number) => n * 60_000;

/**
 * In-memory data source over the eval dataset plus a few demo cases. State
 * lives in this instance only: it resets when the server restarts and is
 * not shared between serverless instances.
 */
export function createMockDataSource(
  options: MockDataSourceOptions = {},
): ExceptionDataSource {
  const now = options.now ?? (() => new Date());
  const cases = new Map<string, ExceptionCase>();
  for (const seeded of seedCases()) {
    cases.set(seeded.caseId, exceptionCaseSchema.parse(seeded));
  }

  return {
    async listCases(filter?: CaseFilter) {
      return [...cases.values()]
        .filter(
          (c) =>
            !filter?.workflowStatus ||
            filter.workflowStatus.includes(c.workflowStatus),
        )
        .filter(
          (c) =>
            !filter?.suite ||
            (c.evaluationMeta !== null &&
              filter.suite.includes(c.evaluationMeta.suite)),
        )
        .sort(
          (a, b) =>
            b.processingContext.receivedAt.localeCompare(
              a.processingContext.receivedAt,
            ) || a.caseId.localeCompare(b.caseId),
        )
        .map((c) => structuredClone(toCaseSummary(c)));
    },

    async getCase(caseId: string) {
      const found = cases.get(caseId);
      return found ? structuredClone(found) : null;
    },

    async submitHumanReview(caseId, input) {
      const parsed = humanReviewSubmissionSchema.safeParse(input);
      if (!parsed.success) {
        throw new DataSourceError(
          "invalid_input",
          `Invalid review:\n${z.prettifyError(parsed.error)}`,
        );
      }
      const current = cases.get(caseId);
      if (!current) {
        throw new DataSourceError("not_found", `No case with id ${caseId}.`);
      }
      if (current.workflowStatus !== "WAITING_FOR_HUMAN_REVIEW") {
        throw new DataSourceError(
          "invalid_state",
          `Case ${caseId} is ${current.workflowStatus ?? "not routed for investigation"}; only cases waiting for human review accept a decision.`,
        );
      }
      // The server clock, not the client, timestamps the review.
      const at = now();
      const updated = applyHumanReview(
        current,
        recordHumanReview(parsed.data, at),
        at,
      );
      cases.set(caseId, updated);
      return structuredClone(updated);
    },
  };
}

/**
 * The 12 eval cases continue past governance into the normal routing
 * (automation or human review) so the UI can show both paths; in an n8n
 * evaluation run the workflow stops after computing metrics instead.
 */
function seedCases(): ExceptionCase[] {
  const evalCases = allEvalCases((i) => ({
    receivedAt: new Date(SEED_START + minutes(15 * i)),
    evaluatedAt: new Date(SEED_START + minutes(15 * i) + 90_000),
  })).map((evalCase, i) => {
    const receivedAt = new Date(SEED_START + minutes(15 * i));
    const opened = openCase(
      {
        batchId: evalCase.batchId,
        transaction: evalCase.transaction,
        processingContext: evalCase.processingContext,
        evaluationMeta: evalCase.evaluationMeta,
        evaluationExpected: evalCase.evaluationExpected,
      },
      receivedAt,
    );
    return recordAgentSteps(
      opened,
      evalCase.agentSteps,
      new Date(evalCase.governance.evaluatedAt),
    );
  });

  const offset = evalCases.length;
  const demoCase = (
    input: (typeof detectionOnlyCases)[number],
    index: number,
  ) => {
    const receivedAt = new Date(SEED_START + minutes(15 * (offset + index)));
    return openCase(
      {
        ...input,
        processingContext: {
          source: "BATCH_INTAKE",
          mode: "NORMAL",
          receivedAt: receivedAt.toISOString(),
        },
      },
      receivedAt,
    );
  };

  return [
    ...evalCases,
    ...detectionOnlyCases.map(demoCase),
    demoCase(underInvestigationCase, detectionOnlyCases.length),
  ];
}
