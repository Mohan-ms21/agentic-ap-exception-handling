import { z } from "zod";
import {
  exceptionCaseSchema,
  investigationPathSchema,
  type ExceptionCase,
} from "@/lib/domain/case";
import { evaluationMetaSchema } from "@/lib/domain/evaluation";
import { governanceCategorySchema } from "@/lib/domain/governance";
import { exceptionTypeSchema } from "@/lib/domain/matching";
import {
  recommendedActionSchema,
  riskLevelSchema,
} from "@/lib/domain/resolution";
import type { HumanReviewSubmission } from "@/lib/domain/review";
import {
  workflowStatusSchema,
  type WorkflowStatus,
} from "@/lib/domain/workflow";

// The contract every backend (mock, n8n, LangGraph) implements. The UI
// depends only on this file, never on a specific backend.

/** One row in the exception queue. */
export const caseSummarySchema = z.object({
  caseId: z.string(),
  invoiceId: z.string(),
  invoiceNumber: z.string(),
  supplierName: z.string(),
  poNumber: z.string(),
  exceptionType: exceptionTypeSchema,
  investigationPath: investigationPathSchema,
  workflowStatus: workflowStatusSchema.nullable(),
  nextAction: z.string().nullable(),
  receivedAt: z.iso.datetime(),
  governanceCategory: governanceCategorySchema.nullable(),
  automationAllowed: z.boolean().nullable(),
  riskLevel: riskLevelSchema.nullable(),
  confidence: z.number().nullable(),
  recommendedAction: recommendedActionSchema.nullable(),
  evaluation: evaluationMetaSchema
    .pick({
      testCaseId: true,
      suite: true,
      scenario: true,
      severity: true,
      redTeamCategory: true,
    })
    .nullable(),
  dataQualityFlagCount: z.int().nonnegative(),
});

export { exceptionCaseSchema };
export type CaseSummary = z.infer<typeof caseSummarySchema>;
export type { ExceptionCase };

export type CaseFilter = {
  /** Only cases in these statuses; null matches cases with no investigation path. */
  workflowStatus?: readonly (WorkflowStatus | null)[];
  suite?: readonly ("CORE" | "RED_TEAM")[];
};

export interface ExceptionDataSource {
  /** Most recently received first. */
  listCases(filter?: CaseFilter): Promise<CaseSummary[]>;

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
}

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

export function toCaseSummary(exceptionCase: ExceptionCase): CaseSummary {
  const { caseContext, agentDecision, governance, evaluationMeta } =
    exceptionCase;
  return {
    caseId: exceptionCase.caseId,
    invoiceId: caseContext.invoiceId,
    invoiceNumber: caseContext.invoiceNumber,
    supplierName: caseContext.supplierName,
    poNumber: caseContext.poNumber,
    exceptionType: caseContext.exceptionType,
    investigationPath: exceptionCase.investigationPath,
    workflowStatus: exceptionCase.workflowStatus,
    nextAction: exceptionCase.nextAction,
    receivedAt: exceptionCase.processingContext.receivedAt,
    governanceCategory: governance?.governanceCategory ?? null,
    automationAllowed: governance?.automationAllowed ?? null,
    riskLevel: agentDecision?.riskLevel ?? null,
    confidence: agentDecision?.confidence ?? null,
    recommendedAction: agentDecision?.recommendedAction ?? null,
    evaluation: evaluationMeta
      ? {
          testCaseId: evaluationMeta.testCaseId,
          suite: evaluationMeta.suite,
          scenario: evaluationMeta.scenario,
          severity: evaluationMeta.severity,
          redTeamCategory: evaluationMeta.redTeamCategory,
        }
      : null,
    dataQualityFlagCount: exceptionCase.dataQualityFlags.length,
  };
}
