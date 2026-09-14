import { z } from "zod";
import {
  agentProposalSchema,
  auditEventSchema,
  confidenceSchema,
  exceptionStatusSchema,
  exceptionTypeSchema,
  goodsReceiptSchema,
  invoiceExceptionSchema,
  invoiceSchema,
  moneySchema,
  purchaseOrderSchema,
  resolutionActionSchema,
  reviewDecisionSchema,
  vendorSchema,
  type ExceptionStatus,
  type ReviewDecision,
} from "@/lib/domain/schemas";

// The contract every backend (mock, n8n, LangGraph) implements. The UI
// depends only on this file, never on a specific backend. Backends that
// receive data over the network validate it against these schemas.

/** One row in the exception queue. */
export const exceptionSummarySchema = z.object({
  id: z.string().min(1),
  type: exceptionTypeSchema,
  status: exceptionStatusSchema,
  detectedAt: z.iso.datetime(),
  invoiceNumber: z.string().min(1),
  poNumber: z.string().min(1),
  vendorName: z.string().min(1),
  invoiceTotal: moneySchema,
  totalAbsoluteVariance: moneySchema,
  proposal: z
    .object({ action: resolutionActionSchema, confidence: confidenceSchema })
    .nullable(),
});

/** Everything the review screen needs for a single exception. */
export const exceptionDetailSchema = z.object({
  exception: invoiceExceptionSchema,
  invoice: invoiceSchema,
  purchaseOrder: purchaseOrderSchema,
  goodsReceipts: z.array(goodsReceiptSchema),
  vendor: vendorSchema,
  proposal: agentProposalSchema.nullable(),
  decision: reviewDecisionSchema.nullable(),
  /** Oldest first. */
  auditTrail: z.array(auditEventSchema),
});

export type ExceptionSummary = z.infer<typeof exceptionSummarySchema>;
export type ExceptionDetail = z.infer<typeof exceptionDetailSchema>;

export type ExceptionFilter = {
  /** Only return exceptions in these statuses. Omit for all. */
  status?: readonly ExceptionStatus[];
};

export interface ExceptionDataSource {
  /** Newest first. */
  listExceptions(filter?: ExceptionFilter): Promise<ExceptionSummary[]>;

  /** Resolves to null if no exception has this id. */
  getException(id: string): Promise<ExceptionDetail | null>;

  /**
   * Records a reviewer's decision on an exception that is awaiting review.
   * Implementations must validate `decision` at runtime, since it originates
   * from user input. Rejects with a DataSourceError when the exception does
   * not exist, is not awaiting review, or the decision is inconsistent with
   * the proposal.
   */
  submitDecision(
    id: string,
    decision: ReviewDecision,
  ): Promise<ExceptionDetail>;
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
