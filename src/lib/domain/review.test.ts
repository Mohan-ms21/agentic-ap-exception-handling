import { describe, expect, it } from "vitest";
import type { AgentDecision } from "./resolution";
import {
  humanReviewFlags,
  humanReviewSubmissionSchema,
  recordHumanReview,
  routeHumanDecision,
  type HumanReview,
} from "./review";

const agentDecision: AgentDecision = {
  rootCause: "UNAPPROVED_PO_AMENDMENT",
  recommendedAction: "ROUTE_TO_BUYER",
  riskLevel: "MEDIUM",
  confidence: 0.92,
  evidence: ["Amendment AMD-EVAL-002 status is PENDING."],
  requiresHumanReview: true,
  explanation: "Pending amendment cannot justify the price.",
};

const review = (overrides: Partial<HumanReview>): HumanReview => ({
  decision: "ACCEPT_RECOMMENDATION",
  reviewer: "AP Analyst",
  notes: "",
  overrideAction: "",
  reviewedAt: "2026-09-01T10:00:00.000+10:00",
  ...overrides,
});

describe("humanReviewSubmissionSchema (app form)", () => {
  it("accepts an acceptance without notes", () => {
    expect(
      humanReviewSubmissionSchema.safeParse({
        reviewDecision: "ACCEPT_RECOMMENDATION",
        reviewerName: "AP Analyst",
      }).success,
    ).toBe(true);
  });

  it.each(["OVERRIDE_RECOMMENDATION", "ESCALATE"])(
    "requires notes for %s (audit requirement)",
    (reviewDecision) => {
      const result = humanReviewSubmissionSchema.safeParse({
        reviewDecision,
        reviewerName: "AP Analyst",
        reviewNotes: "   ",
        overrideAction: "HUMAN_REVIEW",
      });
      expect(result.success).toBe(false);
    },
  );

  it("restricts overrideAction to the four recommended actions", () => {
    const submit = (overrideAction: string) =>
      humanReviewSubmissionSchema.safeParse({
        reviewDecision: "OVERRIDE_RECOMMENDATION",
        reviewerName: "AP Analyst",
        reviewNotes: "Buyer confirmed the old price stands.",
        overrideAction,
      }).success;
    expect(submit("RETRY_LOOKUP")).toBe(true);
    expect(submit("PAY_SUPPLIER")).toBe(false);
    expect(submit("")).toBe(false);
  });

  it("rejects an override action on a decision that is not an override", () => {
    expect(
      humanReviewSubmissionSchema.safeParse({
        reviewDecision: "ESCALATE",
        reviewerName: "AP Analyst",
        reviewNotes: "Needs AP manager sign-off.",
        overrideAction: "ROUTE_TO_BUYER",
      }).success,
    ).toBe(false);
  });

  it("requires a reviewer name", () => {
    expect(
      humanReviewSubmissionSchema.safeParse({
        reviewDecision: "ACCEPT_RECOMMENDATION",
        reviewerName: " ",
      }).success,
    ).toBe(false);
  });
});

describe("recordHumanReview", () => {
  it("maps form fields to the recorded review with the server clock", () => {
    const submission = humanReviewSubmissionSchema.parse({
      reviewDecision: "OVERRIDE_RECOMMENDATION",
      reviewerName: "AP Analyst",
      reviewNotes: "Retry once the ERP is back.",
      overrideAction: "RETRY_LOOKUP",
    });
    expect(
      recordHumanReview(submission, new Date("2026-09-01T00:00:00Z")),
    ).toEqual({
      decision: "OVERRIDE_RECOMMENDATION",
      reviewer: "AP Analyst",
      notes: "Retry once the ERP is back.",
      overrideAction: "RETRY_LOOKUP",
      reviewedAt: "2026-09-01T00:00:00.000Z",
    });
  });
});

describe("routeHumanDecision", () => {
  it("accept: completes review and takes the agent's recommended action", () => {
    expect(routeHumanDecision(agentDecision, review({}))).toEqual({
      workflowStatus: "HUMAN_REVIEW_COMPLETED",
      nextAction: "ROUTE_TO_BUYER",
    });
  });

  it("override: takes the reviewer's override action verbatim", () => {
    expect(
      routeHumanDecision(
        agentDecision,
        review({
          decision: "OVERRIDE_RECOMMENDATION",
          overrideAction: "HUMAN_REVIEW",
        }),
      ),
    ).toEqual({ workflowStatus: "HUMAN_OVERRIDE", nextAction: "HUMAN_REVIEW" });
  });

  it("escalate: routes to the AP manager", () => {
    expect(
      routeHumanDecision(agentDecision, review({ decision: "ESCALATE" })),
    ).toEqual({
      workflowStatus: "ESCALATED",
      nextAction: "AP_MANAGER_REVIEW",
    });
  });

  it("returns null for a decision the n8n Switch has no route for", () => {
    expect(
      routeHumanDecision(agentDecision, review({ decision: "accept" })),
    ).toBeNull();
  });
});

describe("humanReviewFlags (reviews recorded by n8n)", () => {
  it("flags nothing on a well-formed review", () => {
    expect(humanReviewFlags(review({}))).toEqual([]);
    expect(
      humanReviewFlags(
        review({
          decision: "OVERRIDE_RECOMMENDATION",
          overrideAction: "RETRY_LOOKUP",
          notes: "ERP outage.",
        }),
      ),
    ).toEqual([]);
  });

  it("flags an unknown override action instead of rejecting the review", () => {
    const flags = humanReviewFlags(
      review({
        decision: "OVERRIDE_RECOMMENDATION",
        overrideAction: "pay it",
        notes: "Looks fine.",
      }),
    );
    expect(flags.map((f) => f.code)).toEqual(["UNKNOWN_OVERRIDE_ACTION"]);
    expect(flags[0].value).toBe("pay it");
  });

  it("flags a missing override action and missing notes together", () => {
    const flags = humanReviewFlags(
      review({ decision: "OVERRIDE_RECOMMENDATION" }),
    );
    expect(flags.map((f) => f.code)).toEqual([
      "MISSING_OVERRIDE_ACTION",
      "MISSING_REVIEW_NOTES",
    ]);
  });

  it("flags an escalation without notes", () => {
    expect(
      humanReviewFlags(review({ decision: "ESCALATE" })).map((f) => f.code),
    ).toEqual(["MISSING_REVIEW_NOTES"]);
  });

  it("flags an unroutable decision", () => {
    expect(
      humanReviewFlags(review({ decision: "APPROVE" })).map((f) => f.code),
    ).toEqual(["UNKNOWN_REVIEW_DECISION"]);
  });
});
