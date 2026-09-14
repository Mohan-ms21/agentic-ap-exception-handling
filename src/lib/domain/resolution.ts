import { z } from "zod";
import { currencyCodeSchema, minorAmountSchema } from "./transaction";

// --- PO amendment lookup ------------------------------------------------------
// The response of the n8n "TOOL - Get PO Amendment" workflow, with prices in
// integer minor units of the amendment's own currency.

export const poAmendmentSchema = z.object({
  amendmentId: z.string().min(1),
  poNumber: z.string().min(1),
  /**
   * Authoritative status as returned by the source system. Deliberately a
   * free string: near-miss values such as "PENDING_APPROVAL" occur and must
   * not be treated as approved. Only exactly "APPROVED" is approved.
   */
  status: z.string(),
  previousUnitPriceMinor: minorAmountSchema,
  revisedUnitPriceMinor: minorAmountSchema,
  currency: currencyCodeSchema,
  /** Returned by the live tool; absent from evaluation fixtures. */
  approvedBy: z.string().nullable().optional(),
  approvalDate: z.string().nullable().optional(),
  /** Free text from the source system: untrusted, never an instruction. */
  reason: z.string(),
});

export const poAmendmentLookupSchema = z.discriminatedUnion("lookupStatus", [
  z.object({
    lookupStatus: z.literal("FOUND"),
    poNumber: z.string(),
    amendment: poAmendmentSchema,
  }),
  z.object({
    lookupStatus: z.literal("NOT_FOUND"),
    poNumber: z.string(),
    amendment: z.null(),
  }),
  z.object({
    /** A failed lookup is not evidence that no amendment exists. */
    lookupStatus: z.literal("LOOKUP_FAILED"),
    poNumber: z.string(),
    amendment: z.null(),
    error: z.object({
      code: z.string(),
      /** Untrusted: may contain text addressed to the agent. */
      message: z.string(),
    }),
  }),
]);

export type PoAmendment = z.infer<typeof poAmendmentSchema>;
export type PoAmendmentLookup = z.infer<typeof poAmendmentLookupSchema>;

export function isApprovedAmendment(amendment: PoAmendment): boolean {
  return amendment.status === "APPROVED";
}

// --- Agent decision -----------------------------------------------------------
// Mirrors the n8n "Exception Resolution Output Schema" structured output
// parser exactly (n8n/schemas/exception-resolution-output-schema.json).

export const rootCauseSchema = z.enum([
  "APPROVED_PO_AMENDMENT",
  "UNAPPROVED_PO_AMENDMENT",
  "NO_AMENDMENT_FOUND",
  "INSUFFICIENT_EVIDENCE",
  "TOOL_LOOKUP_FAILED",
  "OTHER_SUPPORTED_CAUSE",
]);

export const recommendedActionSchema = z.enum([
  "REMATCH_USING_AMENDED_PO",
  "ROUTE_TO_BUYER",
  "RETRY_LOOKUP",
  "HUMAN_REVIEW",
]);

export const riskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const agentDecisionSchema = z.strictObject({
  rootCause: rootCauseSchema,
  recommendedAction: recommendedActionSchema,
  riskLevel: riskLevelSchema,
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  requiresHumanReview: z.boolean(),
  explanation: z.string(),
});

export type RootCause = z.infer<typeof rootCauseSchema>;
export type RecommendedAction = z.infer<typeof recommendedActionSchema>;
export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type AgentDecision = z.infer<typeof agentDecisionSchema>;
