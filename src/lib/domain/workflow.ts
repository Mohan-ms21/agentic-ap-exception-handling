import { z } from "zod";

// Workflow states and actions set by the n8n "AP Invoice processing"
// workflow's Set nodes.

/** n8n `$now.toISO()` timestamps carry a UTC offset (e.g. +10:00). */
export const n8nTimestampSchema = z.iso.datetime({ offset: true });

export const workflowStatusSchema = z.enum([
  "MATCHED", // Matched - Continue Processing
  "UNDER_AGENT_INVESTIGATION", // Prepare Exception Case
  "READY_FOR_AUTOMATED_RESOLUTION", // Approved for Automated Resolution
  "WAITING_FOR_HUMAN_REVIEW", // Prepare Human Review Case
  "HUMAN_REVIEW_COMPLETED", // Human Accepted Recommendation
  "HUMAN_OVERRIDE", // Human Override
  "ESCALATED", // Escalate to AP Manager
]);

/**
 * Known nextAction values. The field itself stays a string: after an
 * override it holds whatever the reviewer entered in the n8n form.
 */
export const KNOWN_NEXT_ACTIONS = [
  "CONTINUE_TO_POSTING",
  "REMATCH_USING_AMENDED_PO",
  "ROUTE_TO_BUYER",
  "RETRY_LOOKUP",
  "HUMAN_REVIEW",
  "AP_MANAGER_REVIEW",
] as const;

export const humanReviewRequestSchema = z.object({
  /** n8n's Wait node resume form URL; null outside n8n. */
  formUrl: z.string().nullable(),
  requestedAt: n8nTimestampSchema,
  status: z.literal("PENDING"),
});

export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;
export type HumanReviewRequest = z.infer<typeof humanReviewRequestSchema>;
