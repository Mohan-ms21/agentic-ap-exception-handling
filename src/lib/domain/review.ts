import { z } from "zod";
import { recommendedActionSchema, type AgentDecision } from "./resolution";
import { n8nTimestampSchema, type WorkflowStatus } from "./workflow";

// Human review of an agent recommendation: the n8n "Wait for AP Analyst
// Decision" form, "Record Human Review" and "Route Human Decision" nodes.

export const reviewDecisionSchema = z.enum([
  "ACCEPT_RECOMMENDATION",
  "OVERRIDE_RECOMMENDATION",
  "ESCALATE",
]);

/**
 * A human review as recorded by n8n. Deliberately lenient: the n8n form does
 * not validate its fields (overrideAction is free text, notes are optional),
 * so recorded reviews are accepted as-is and problems are reported through
 * humanReviewFlags() instead of being rejected.
 */
export const humanReviewSchema = z.object({
  decision: z.string(),
  reviewer: z.string(),
  notes: z.string(),
  overrideAction: z.string(),
  reviewedAt: n8nTimestampSchema,
});

const reviewerName = z.string().trim().min(1, "Reviewer name is required");
const requiredNotes = z
  .string()
  .trim()
  .min(
    1,
    "Notes are required when overriding or escalating (audit requirement)",
  );

/**
 * A review submitted from this app. Stricter than n8n's form: an override
 * must name one of the four recommended actions, and overrides and
 * escalations must be explained. Field names match the n8n form.
 */
export const humanReviewSubmissionSchema = z.discriminatedUnion(
  "reviewDecision",
  [
    z.strictObject({
      reviewDecision: z.literal("ACCEPT_RECOMMENDATION"),
      reviewerName,
      reviewNotes: z.string().trim().optional(),
    }),
    z.strictObject({
      reviewDecision: z.literal("OVERRIDE_RECOMMENDATION"),
      reviewerName,
      reviewNotes: requiredNotes,
      overrideAction: recommendedActionSchema,
    }),
    z.strictObject({
      reviewDecision: z.literal("ESCALATE"),
      reviewerName,
      reviewNotes: requiredNotes,
    }),
  ],
);

export const dataQualityFlagSchema = z.object({
  code: z.enum([
    "UNKNOWN_REVIEW_DECISION",
    "MISSING_OVERRIDE_ACTION",
    "UNKNOWN_OVERRIDE_ACTION",
    "MISSING_REVIEW_NOTES",
  ]),
  field: z.string(),
  value: z.string(),
  message: z.string(),
});

export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export type HumanReview = z.infer<typeof humanReviewSchema>;
export type HumanReviewSubmission = z.infer<typeof humanReviewSubmissionSchema>;
export type DataQualityFlag = z.infer<typeof dataQualityFlagSchema>;

/** Port of "Record Human Review": form fields to the recorded review. */
export function recordHumanReview(
  submission: HumanReviewSubmission,
  now: Date = new Date(),
): HumanReview {
  return {
    decision: submission.reviewDecision,
    reviewer: submission.reviewerName,
    notes: submission.reviewNotes ?? "",
    overrideAction:
      submission.reviewDecision === "OVERRIDE_RECOMMENDATION"
        ? submission.overrideAction
        : "",
    reviewedAt: now.toISOString(),
  };
}

export type HumanDecisionOutcome = {
  workflowStatus: Extract<
    WorkflowStatus,
    "HUMAN_REVIEW_COMPLETED" | "HUMAN_OVERRIDE" | "ESCALATED"
  >;
  nextAction: string;
};

/**
 * Port of "Route Human Decision" and its three Set nodes. Returns null for a
 * decision the Switch node has no route for: n8n stops the item there.
 */
export function routeHumanDecision(
  agentDecision: AgentDecision,
  review: HumanReview,
): HumanDecisionOutcome | null {
  switch (review.decision) {
    case "ACCEPT_RECOMMENDATION":
      return {
        workflowStatus: "HUMAN_REVIEW_COMPLETED",
        nextAction: agentDecision.recommendedAction,
      };
    case "OVERRIDE_RECOMMENDATION":
      return {
        workflowStatus: "HUMAN_OVERRIDE",
        nextAction: review.overrideAction,
      };
    case "ESCALATE":
      return { workflowStatus: "ESCALATED", nextAction: "AP_MANAGER_REVIEW" };
    default:
      return null;
  }
}

/** Problems in a recorded review that the app's own form would not allow. */
export function humanReviewFlags(review: HumanReview): DataQualityFlag[] {
  const flags: DataQualityFlag[] = [];
  const decision = reviewDecisionSchema.safeParse(review.decision);

  if (!decision.success) {
    flags.push({
      code: "UNKNOWN_REVIEW_DECISION",
      field: "humanReview.decision",
      value: review.decision,
      message: `Review decision "${review.decision}" is not one the workflow can route; the case did not proceed.`,
    });
    return flags;
  }

  if (decision.data === "OVERRIDE_RECOMMENDATION") {
    const action = review.overrideAction.trim();
    if (action === "") {
      flags.push({
        code: "MISSING_OVERRIDE_ACTION",
        field: "humanReview.overrideAction",
        value: review.overrideAction,
        message: "Override recorded without an override action.",
      });
    } else if (!recommendedActionSchema.safeParse(action).success) {
      flags.push({
        code: "UNKNOWN_OVERRIDE_ACTION",
        field: "humanReview.overrideAction",
        value: review.overrideAction,
        message: `Override action "${review.overrideAction}" is not one of ${recommendedActionSchema.options.join(", ")}.`,
      });
    }
  }

  if (decision.data !== "ACCEPT_RECOMMENDATION" && review.notes.trim() === "") {
    flags.push({
      code: "MISSING_REVIEW_NOTES",
      field: "humanReview.notes",
      value: review.notes,
      message:
        "Overrides and escalations require review notes for the audit record.",
    });
  }

  return flags;
}
