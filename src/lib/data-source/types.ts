import { z } from "zod";
import {
  caseAgentDecision,
  exceptionCaseSchema,
  investigationPathSchema,
  type ExceptionCase,
} from "@/lib/domain/case";
import {
  invoiceExecutionSchema,
  isExceptionCase,
  type InvoiceExecution,
} from "@/lib/domain/execution";
import { governanceCategorySchema } from "@/lib/domain/governance";
import { exceptionTypeSchema } from "@/lib/domain/matching";
import {
  recommendedActionSchema,
  riskLevelSchema,
} from "@/lib/domain/resolution";
import type { HumanReviewSubmission } from "@/lib/domain/review";
import type { EvaluationRun, ModelRunState } from "@/lib/eval/runs";
import { workflowStatusSchema } from "@/lib/domain/workflow";

// The contract every backend (mock, n8n, LangGraph) implements. The UI
// depends only on this file, never on a specific backend.

/** One invoice in a batch: its matching result and, if any, its case. */
export const invoiceExecutionSummarySchema = z.object({
  batchId: z.string(),
  invoiceId: z.string(),
  invoiceNumber: z.string(),
  supplierName: z.string(),
  poNumber: z.string(),
  receivedAt: z.iso.datetime(),
  matchStatus: z.enum(["MATCHED", "EXCEPTION"]),
  primaryExceptionType: exceptionTypeSchema.nullable(),
  exceptionCount: z.int().nonnegative(),
  caseId: z.string().nullable(),
  investigationPath: investigationPathSchema.nullable(),
  workflowStatus: workflowStatusSchema.nullable(),
  nextAction: z.string().nullable(),
  governanceCategory: governanceCategorySchema.nullable(),
  automationAllowed: z.boolean().nullable(),
  riskLevel: riskLevelSchema.nullable(),
  confidence: z.number().nullable(),
  recommendedAction: recommendedActionSchema.nullable(),
  dataQualityFlagCount: z.int().nonnegative(),
});

export { exceptionCaseSchema, invoiceExecutionSchema };
export type InvoiceExecutionSummary = z.infer<
  typeof invoiceExecutionSummarySchema
>;
export type { ExceptionCase, InvoiceExecution };

export interface ExceptionDataSource {
  /** Every invoice in the demo batch, in batch order. */
  listInvoiceExecutions(): Promise<InvoiceExecutionSummary[]>;

  /** Resolves to null if no invoice has this id. */
  getInvoiceExecution(invoiceId: string): Promise<InvoiceExecution | null>;

  /** Resolves to null if no case has this id. */
  getCase(caseId: string): Promise<ExceptionCase | null>;

  /**
   * Records a reviewer's decision on a case waiting for human review.
   * Implementations must validate `submission` at runtime (it is user
   * input) and reject with a DataSourceError when the case does not exist,
   * is not waiting for review, or the submission is invalid.
   */
  submitHumanReview(
    caseId: string,
    submission: HumanReviewSubmission,
  ): Promise<ExceptionCase>;

  /**
   * Evaluation results: the latest imported n8n model run, if any, and the
   * scoring self-test, which must never be presented as a model result.
   */
  getEvaluationRuns(): Promise<EvaluationRuns>;
}

export type EvaluationRuns = {
  modelRun: ModelRunState;
  selfTest: EvaluationRun;
};

export type DataSourceErrorCode =
  "not_found" | "invalid_state" | "invalid_input";

export class DataSourceError extends Error {
  constructor(
    readonly code: DataSourceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DataSourceError";
  }
}

export function toInvoiceExecutionSummary(
  execution: InvoiceExecution,
): InvoiceExecutionSummary {
  const { invoice } = execution.transaction;
  const exceptionCase = isExceptionCase(execution) ? execution : null;
  const agentDecision = exceptionCase ? caseAgentDecision(exceptionCase) : null;
  return {
    batchId: execution.batchId,
    invoiceId: invoice.invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    supplierName: invoice.supplierName,
    poNumber: invoice.poNumber,
    receivedAt: execution.processingContext.receivedAt,
    matchStatus: execution.matchingResult.matchStatus,
    primaryExceptionType: execution.matchingResult.primaryExceptionType,
    exceptionCount: execution.matchingResult.exceptionCount,
    caseId: exceptionCase?.caseId ?? null,
    investigationPath: exceptionCase?.investigationPath ?? null,
    workflowStatus: execution.workflowStatus,
    nextAction: execution.nextAction,
    governanceCategory: exceptionCase?.governance?.governanceCategory ?? null,
    automationAllowed: exceptionCase?.governance?.automationAllowed ?? null,
    riskLevel: agentDecision?.riskLevel ?? null,
    confidence: agentDecision?.confidence ?? null,
    recommendedAction: agentDecision?.recommendedAction ?? null,
    dataQualityFlagCount: exceptionCase?.dataQualityFlags.length ?? 0,
  };
}
