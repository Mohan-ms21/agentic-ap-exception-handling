import { z } from "zod";
import {
  exceptionCaseSchema,
  openCase,
  type ExceptionCase,
  type OpenCaseInput,
} from "./case";
import { matchingResultSchema, runMatching } from "./matching";
import { processingContextSchema, transactionSchema } from "./transaction";

// One invoice is one child workflow execution (sections 7.2 and 8). An
// execution either matches and continues to posting, or opens an exception
// case.

export const matchedInvoiceSchema = z.object({
  batchId: z.string().min(1),
  transaction: transactionSchema,
  processingContext: processingContextSchema,
  matchingResult: matchingResultSchema,
  // Set by the n8n "Matched - Continue Processing" node.
  workflowStatus: z.literal("MATCHED"),
  nextAction: z.literal("CONTINUE_TO_POSTING"),
});

export const invoiceExecutionSchema = z.union([
  matchedInvoiceSchema,
  exceptionCaseSchema,
]);

export type MatchedInvoice = z.infer<typeof matchedInvoiceSchema>;
export type InvoiceExecution = MatchedInvoice | ExceptionCase;

export function isExceptionCase(
  execution: InvoiceExecution,
): execution is ExceptionCase {
  return "caseId" in execution;
}

/** Runs matching for one invoice ("Exception Detected?") and branches. */
export function startInvoiceExecution(
  input: OpenCaseInput,
  now: Date = new Date(),
): InvoiceExecution {
  const matchingResult = runMatching(input.transaction);
  if (!matchingResult.exceptionDetected) {
    return {
      batchId: input.batchId,
      transaction: input.transaction,
      processingContext: input.processingContext,
      matchingResult,
      workflowStatus: "MATCHED",
      nextAction: "CONTINUE_TO_POSTING",
    };
  }
  return openCase(input, now);
}
