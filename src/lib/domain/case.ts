import { z } from "zod";
import { agentStepSchema, resolutionStep, type AgentStep } from "./agent-steps";
import { auditRecordSchema, buildAuditRecord } from "./audit";
import { evaluationExpectedSchema, evaluationMetaSchema } from "./evaluation";
import { applyGovernance, governanceSchema } from "./governance";
import {
  exceptionTypeSchema,
  matchingResultSchema,
  runMatching,
} from "./matching";
import type { AgentDecision } from "./resolution";
import {
  dataQualityFlagSchema,
  humanReviewFlags,
  humanReviewSchema,
  routeHumanDecision,
  type HumanReview,
} from "./review";
import {
  processingContextSchema,
  transactionSchema,
  type ProcessingContext,
  type Transaction,
} from "./transaction";
import { humanReviewRequestSchema, workflowStatusSchema } from "./workflow";

// An exception case as it moves through the n8n "AP Invoice processing"
// workflow: matching, agent investigation, governance, human review, audit.

/**
 * Exception types with an investigation path in the workflow. The n8n
 * "Route by Exception Type" switch has outputs for all five types, but only
 * Price Variance is connected to anything; the other four stop at detection.
 */
export const INVESTIGATED_EXCEPTION_TYPES = ["PRICE_VARIANCE"] as const;

export const investigationPathSchema = z.enum(["PRICE_VARIANCE_AGENT", "NONE"]);

export const caseContextSchema = z.object({
  invoiceId: z.string(),
  invoiceNumber: z.string(),
  supplierId: z.string(),
  supplierName: z.string(),
  poNumber: z.string(),
  currency: z.string(),
  exceptionType: exceptionTypeSchema,
});

export const exceptionCaseSchema = z.object({
  caseId: z.string().min(1),
  batchId: z.string().min(1),
  transaction: transactionSchema,
  processingContext: processingContextSchema,
  matchingResult: matchingResultSchema,
  caseContext: caseContextSchema,
  investigationPath: investigationPathSchema,
  /** Agent work in order; empty until the agent has reported. */
  agentSteps: z.array(agentStepSchema),
  governance: governanceSchema.nullable(),
  humanReviewRequest: humanReviewRequestSchema.nullable(),
  humanReview: humanReviewSchema.nullable(),
  /** Null when the exception type has no investigation path yet. */
  workflowStatus: workflowStatusSchema.nullable(),
  nextAction: z.string().nullable(),
  auditRecord: auditRecordSchema.nullable(),
  evaluationMeta: evaluationMetaSchema.nullable(),
  evaluationExpected: evaluationExpectedSchema.nullable(),
  dataQualityFlags: z.array(dataQualityFlagSchema),
});

export type InvestigationPath = z.infer<typeof investigationPathSchema>;
export type CaseContext = z.infer<typeof caseContextSchema>;
export type ExceptionCase = z.infer<typeof exceptionCaseSchema>;

export class CaseTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaseTransitionError";
  }
}

export type OpenCaseInput = {
  batchId: string;
  transaction: Transaction;
  processingContext: ProcessingContext;
  evaluationMeta?: ExceptionCase["evaluationMeta"];
  evaluationExpected?: ExceptionCase["evaluationExpected"];
};

/**
 * Runs matching and opens a case for the primary exception ("Prepare
 * Exception Case"). Throws for a clean match: it is not an exception case.
 */
export function openCase(
  input: OpenCaseInput,
  now: Date = new Date(),
): ExceptionCase {
  const matchingResult = runMatching(input.transaction);
  const exceptionType = matchingResult.primaryExceptionType;
  if (!exceptionType) {
    throw new CaseTransitionError(
      `Invoice ${input.transaction.invoice.invoiceId} matched; there is no exception to open.`,
    );
  }
  const { invoice } = input.transaction;
  const investigated = (
    INVESTIGATED_EXCEPTION_TYPES as readonly string[]
  ).includes(exceptionType);

  return {
    caseId: `EXC-${invoice.invoiceId}-${now.getTime()}`,
    batchId: input.batchId,
    transaction: input.transaction,
    processingContext: input.processingContext,
    matchingResult,
    caseContext: {
      invoiceId: invoice.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      supplierId: invoice.supplierId,
      supplierName: invoice.supplierName,
      poNumber: invoice.poNumber,
      currency: invoice.currency,
      exceptionType,
    },
    investigationPath: investigated ? "PRICE_VARIANCE_AGENT" : "NONE",
    agentSteps: [],
    governance: null,
    humanReviewRequest: null,
    humanReview: null,
    workflowStatus: investigated ? "UNDER_AGENT_INVESTIGATION" : null,
    nextAction: null,
    auditRecord: null,
    evaluationMeta: input.evaluationMeta ?? null,
    evaluationExpected: input.evaluationExpected ?? null,
    dataQualityFlags: [],
  };
}

/**
 * Records the agent steps and applies the risk policy to the final
 * (resolution) step's output: automation goes to "Approved for Automated
 * Resolution" (and is audited), everything else to "Prepare Human Review
 * Case".
 */
export function recordAgentSteps(
  current: ExceptionCase,
  agentSteps: readonly AgentStep[],
  now: Date = new Date(),
): ExceptionCase {
  if (current.workflowStatus !== "UNDER_AGENT_INVESTIGATION") {
    throw new CaseTransitionError(
      `Case ${current.caseId} is ${current.workflowStatus ?? "not investigated"}; agent steps can only be recorded while under investigation.`,
    );
  }
  const decision = resolutionStep(
    agentSteps,
    current.caseContext.exceptionType,
  ).output;
  const exceptionType = current.caseContext.exceptionType;
  const governance = applyGovernance(exceptionType, agentSteps, now);
  const withSteps = { ...current, agentSteps: [...agentSteps], governance };

  if (governance.automationAllowed) {
    const workflowStatus = "READY_FOR_AUTOMATED_RESOLUTION" as const;
    const nextAction = "REMATCH_USING_AMENDED_PO";
    return {
      ...withSteps,
      workflowStatus,
      nextAction,
      auditRecord: buildAuditRecord(
        {
          ...withSteps,
          agentDecision: decision,
          humanReview: null,
          workflowStatus,
          nextAction,
        },
        now,
      ),
    };
  }
  return {
    ...withSteps,
    workflowStatus: "WAITING_FOR_HUMAN_REVIEW",
    humanReviewRequest: {
      formUrl: null,
      requestedAt: now.toISOString(),
      status: "PENDING",
    },
  };
}

/**
 * The resolution output of a case: what n8n calls `agentDecision`. Null until
 * the agent has reported.
 */
export function caseAgentDecision(
  exceptionCase: ExceptionCase,
): AgentDecision | null {
  if (exceptionCase.agentSteps.length === 0) return null;
  return resolutionStep(
    exceptionCase.agentSteps,
    exceptionCase.caseContext.exceptionType,
  ).output;
}

/**
 * Records a human review and routes it ("Route Human Decision"). A review
 * the workflow cannot route is recorded and flagged, and the case stays
 * waiting, as the n8n item stops at the switch.
 */
export function applyHumanReview(
  current: ExceptionCase,
  humanReview: HumanReview,
  now: Date = new Date(),
): ExceptionCase {
  const agentDecision = caseAgentDecision(current);
  if (current.workflowStatus !== "WAITING_FOR_HUMAN_REVIEW" || !agentDecision) {
    throw new CaseTransitionError(
      `Case ${current.caseId} is ${current.workflowStatus ?? "not investigated"}; only cases waiting for human review accept a decision.`,
    );
  }
  const withReview = {
    ...current,
    humanReview,
    dataQualityFlags: humanReviewFlags(humanReview),
  };
  const outcome = routeHumanDecision(agentDecision, humanReview);
  if (!outcome) return withReview;

  return {
    ...withReview,
    ...outcome,
    auditRecord: buildAuditRecord(
      { ...withReview, ...outcome, agentDecision },
      now,
    ),
  };
}
