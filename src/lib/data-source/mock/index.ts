import { z } from "zod";
import {
  applyHumanReview,
  recordAgentSteps,
  type ExceptionCase,
} from "@/lib/domain/case";
import {
  invoiceExecutionSchema,
  isExceptionCase,
  startInvoiceExecution,
  type InvoiceExecution,
} from "@/lib/domain/execution";
import {
  humanReviewSubmissionSchema,
  recordHumanReview,
} from "@/lib/domain/review";
import { batchIntakeRows } from "@/lib/batch/batch-intake.generated";
import { buildInvoiceProcessingInput } from "@/lib/batch/build-invoice-processing-input";
import {
  DataSourceError,
  toInvoiceExecutionSummary,
  type ExceptionDataSource,
} from "../types";
import { evaluationCases, modelRuns, selfTestRun } from "@/lib/eval/runs";
import { demoAgentStep } from "./demo-agent";

export type MockDataSourceOptions = {
  /** Clock used to timestamp human reviews and audit records. */
  now?: () => Date;
};

/** The batch shown in the demo walkthrough (section 31.2). */
export const DEMO_BATCH_ID = "BATCH-DEMO-001";

/**
 * Seed timestamps follow the solution documentation's INV-3002 example:
 * received 2026-09-09T15:34:00.398Z, governance evaluated 18 seconds later.
 */
const BATCH_RECEIVED_AT = Date.parse("2026-09-09T15:34:00.398Z");
const AGENT_DURATION_MS = 17_784;

/**
 * In-memory data source over the demo batch. State lives in this instance
 * only: it resets when the server restarts and is not shared between
 * serverless instances.
 */
export function createMockDataSource(
  options: MockDataSourceOptions = {},
): ExceptionDataSource {
  const now = options.now ?? (() => new Date());
  const executions = new Map<string, InvoiceExecution>();
  for (const execution of seedExecutions()) {
    executions.set(
      execution.transaction.invoice.invoiceId,
      invoiceExecutionSchema.parse(execution) as InvoiceExecution,
    );
  }

  const findCase = (caseId: string) =>
    [...executions.values()].find(
      (e): e is ExceptionCase => isExceptionCase(e) && e.caseId === caseId,
    );

  return {
    async listInvoiceExecutions() {
      return [...executions.values()].map((e) =>
        structuredClone(toInvoiceExecutionSummary(e)),
      );
    },

    async getInvoiceExecution(invoiceId) {
      const found = executions.get(invoiceId);
      return found ? structuredClone(found) : null;
    },

    async getCase(caseId) {
      const found = findCase(caseId);
      return found ? structuredClone(found) : null;
    },

    async getEvaluationRuns() {
      return {
        cases: evaluationCases(),
        modelRuns: modelRuns(),
        selfTest: selfTestRun(),
      };
    },

    async submitHumanReview(caseId, input) {
      const parsed = humanReviewSubmissionSchema.safeParse(input);
      if (!parsed.success) {
        throw new DataSourceError(
          "invalid_input",
          `Invalid review:\n${z.prettifyError(parsed.error)}`,
        );
      }
      const current = findCase(caseId);
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
      executions.set(updated.transaction.invoice.invoiceId, updated);
      return structuredClone(updated);
    },
  };
}

function seedExecutions(): InvoiceExecution[] {
  return batchIntakeRows
    .filter((row) => row.batchId === DEMO_BATCH_ID)
    .map((row) => {
      const receivedAt = new Date(BATCH_RECEIVED_AT);
      const execution = startInvoiceExecution(
        buildInvoiceProcessingInput(row, receivedAt),
        receivedAt,
      );
      if (
        !isExceptionCase(execution) ||
        execution.investigationPath !== "PRICE_VARIANCE_AGENT"
      ) {
        return execution;
      }
      const completedAt = new Date(BATCH_RECEIVED_AT + AGENT_DURATION_MS);
      const step = demoAgentStep(
        execution.caseContext.invoiceId,
        execution.transaction.purchaseOrder?.poNumber ??
          execution.caseContext.poNumber,
        { startedAt: receivedAt, completedAt },
      );
      return recordAgentSteps(execution, [step], completedAt);
    });
}
