import { z } from "zod";
import type { AgentDecision } from "./resolution";

// Port of the n8n "Apply Resolution Risk Policy" Code node
// (n8n/code-nodes/apply-resolution-risk-policy.js), verified by
// governance.differential.test.ts. The agent recommends; this policy, not
// the agent, decides whether a resolution may be automated.

export const governanceCategorySchema = z.enum([
  "SAFE_AUTOMATION",
  "TECHNICAL_EXCEPTION",
  "BUSINESS_REVIEW_REQUIRED",
]);

export const governanceSchema = z.object({
  automationAllowed: z.boolean(),
  governanceCategory: governanceCategorySchema,
  governanceReason: z.string(),
  evaluatedAt: z.iso.datetime(),
});

export type GovernanceCategory = z.infer<typeof governanceCategorySchema>;
export type Governance = z.infer<typeof governanceSchema>;

/** Minimum agent confidence for automation (inclusive). */
export const AUTOMATION_CONFIDENCE_THRESHOLD = 0.9;

export const GOVERNANCE_REASONS: Record<GovernanceCategory, string> = {
  SAFE_AUTOMATION:
    "Approved PO amendment supports the invoice price and all low-risk automation criteria were satisfied.",
  TECHNICAL_EXCEPTION:
    "Authoritative evidence could not be retrieved. Automated resolution is blocked until the lookup succeeds.",
  BUSINESS_REVIEW_REQUIRED:
    "One or more automation criteria were not satisfied; human review is required.",
};

export function applyResolutionRiskPolicy(
  decision: AgentDecision,
  now: Date = new Date(),
): Governance {
  const category = governanceCategoryFor(decision);
  return {
    automationAllowed: category === "SAFE_AUTOMATION",
    governanceCategory: category,
    governanceReason: GOVERNANCE_REASONS[category],
    evaluatedAt: now.toISOString(),
  };
}

function governanceCategoryFor(decision: AgentDecision): GovernanceCategory {
  // Automation requires every criterion; any single miss falls through.
  if (
    decision.rootCause === "APPROVED_PO_AMENDMENT" &&
    decision.recommendedAction === "REMATCH_USING_AMENDED_PO" &&
    decision.riskLevel === "LOW" &&
    decision.confidence >= AUTOMATION_CONFIDENCE_THRESHOLD &&
    decision.requiresHumanReview === false
  ) {
    return "SAFE_AUTOMATION";
  }
  if (
    decision.rootCause === "TOOL_LOOKUP_FAILED" ||
    decision.recommendedAction === "RETRY_LOOKUP"
  ) {
    return "TECHNICAL_EXCEPTION";
  }
  return "BUSINESS_REVIEW_REQUIRED";
}
