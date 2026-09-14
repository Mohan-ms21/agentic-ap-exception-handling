import { z } from "zod";
import { governanceSchema, type Governance } from "./governance";
import { agentDecisionSchema, type AgentDecision } from "./resolution";
import { humanReviewSchema, type HumanReview } from "./review";

// Port of the n8n "Build Resolution Audit Record" Code node: one record per
// case, written when the case reaches an outcome.

export const AGENT_VERSION = "1.0.0";
export const MATCHING_POLICY_VERSION = "DEMO-MATCH-1";

export const auditRecordSchema = z.object({
  caseId: z.string(),
  transaction: z.object({
    invoiceId: z.string().nullable(),
    invoiceNumber: z.string().nullable(),
    poNumber: z.string().nullable(),
    supplierId: z.string().nullable(),
  }),
  exception: z.object({ type: z.string().nullable() }),
  agentDecision: agentDecisionSchema.nullable(),
  governance: governanceSchema.nullable(),
  humanReview: humanReviewSchema.nullable(),
  finalOutcome: z.object({
    workflowStatus: z.string().nullable(),
    nextAction: z.string().nullable(),
  }),
  technicalContext: z.object({
    agentVersion: z.string(),
    matchingPolicyVersion: z.string(),
  }),
  auditTimestamp: z.iso.datetime({ offset: true }),
});

export type AuditRecord = z.infer<typeof auditRecordSchema>;

export type AuditRecordInput = {
  caseId: string;
  caseContext: {
    invoiceId?: string;
    invoiceNumber?: string;
    poNumber?: string;
    supplierId?: string;
    exceptionType?: string;
  } | null;
  agentDecision: AgentDecision | null;
  governance: Governance | null;
  humanReview: HumanReview | null;
  workflowStatus: string | null;
  nextAction: string | null;
};

export function buildAuditRecord(
  input: AuditRecordInput,
  now: Date = new Date(),
): AuditRecord {
  // n8n uses `value || null`, so empty strings are recorded as null.
  const orNull = (value: string | null | undefined) => value || null;
  return {
    caseId: input.caseId,
    transaction: {
      invoiceId: orNull(input.caseContext?.invoiceId),
      invoiceNumber: orNull(input.caseContext?.invoiceNumber),
      poNumber: orNull(input.caseContext?.poNumber),
      supplierId: orNull(input.caseContext?.supplierId),
    },
    exception: { type: orNull(input.caseContext?.exceptionType) },
    agentDecision: input.agentDecision,
    governance: input.governance,
    humanReview: input.humanReview,
    finalOutcome: {
      workflowStatus: orNull(input.workflowStatus),
      nextAction: orNull(input.nextAction),
    },
    technicalContext: {
      agentVersion: AGENT_VERSION,
      matchingPolicyVersion: MATCHING_POLICY_VERSION,
    },
    auditTimestamp: now.toISOString(),
  };
}
