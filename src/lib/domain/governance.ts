import { z } from "zod";
import { resolutionStep, type AgentStep } from "./agent-steps";
import type { ExceptionType } from "./matching";
import type { AgentDecision } from "./resolution";

// Deterministic governance: the agent recommends; a policy, not the agent,
// decides whether a resolution may be automated (sections 4.5 and 15).
//
// Policies are registered by exception type. The three governance
// categories are global; each policy decides which one applies.

export const governanceCategorySchema = z.enum([
  "SAFE_AUTOMATION",
  "TECHNICAL_EXCEPTION",
  "BUSINESS_REVIEW_REQUIRED",
]);

/**
 * Deterministic check of the authoritative PO amendment record, written by
 * the hardened n8n policy. LOOKUP_FAILED means the evidence could not be
 * retrieved (an outage, a missing result, or a result for another PO);
 * CONTRADICTION means the lookup succeeded but does not support automation
 * (no amendment, status not APPROVED, price or currency mismatch).
 */
export const evidenceVerificationSchema = z.object({
  outcome: z.enum(["VERIFIED", "LOOKUP_FAILED", "CONTRADICTION"]),
  verified: z.boolean(),
  /** Whether the agent's decision met every automation criterion. */
  agentClaimedAutomation: z.boolean(),
  failures: z.array(
    z.object({
      type: z.enum(["LOOKUP_FAILED", "CONTRADICTION"]),
      check: z.string(),
      message: z.string(),
    }),
  ),
});

export const governanceSchema = z.object({
  automationAllowed: z.boolean(),
  governanceCategory: governanceCategorySchema,
  governanceReason: z.string(),
  /** Present only when the policy verifies tool evidence (hardened policy). */
  evidenceVerification: evidenceVerificationSchema.optional(),
  evaluatedAt: z.iso.datetime(),
});

export type GovernanceCategory = z.infer<typeof governanceCategorySchema>;
export type Governance = z.infer<typeof governanceSchema>;
export type EvidenceVerification = z.infer<typeof evidenceVerificationSchema>;

export type GovernancePolicy<TOutput> = {
  /** The n8n node that implements this policy. */
  n8nNode: string;
  /**
   * Whether the policy checks the authoritative tool result itself, or
   * relies on the agent's asserted root cause. Shown on the governance
   * panel so the limitation is visible.
   */
  verifiesToolEvidence: boolean;
  evaluate(output: TOutput): { category: GovernanceCategory; reason: string };
};

// --- Price variance -------------------------------------------------------------
// Port of the n8n "Apply Resolution Risk Policy" Code node
// (n8n/code-nodes/apply-resolution-risk-policy.js), verified by
// governance.differential.test.ts.

/** Minimum agent confidence for automation (inclusive). */
export const AUTOMATION_CONFIDENCE_THRESHOLD = 0.9;

export const PRICE_VARIANCE_GOVERNANCE_REASONS: Record<
  GovernanceCategory,
  string
> = {
  SAFE_AUTOMATION:
    "Approved PO amendment supports the invoice price and all low-risk automation criteria were satisfied.",
  TECHNICAL_EXCEPTION:
    "Authoritative evidence could not be retrieved. Automated resolution is blocked until the lookup succeeds.",
  BUSINESS_REVIEW_REQUIRED:
    "One or more automation criteria were not satisfied; human review is required.",
};

function priceVarianceCategory(decision: AgentDecision): GovernanceCategory {
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

export type AutomationCriterion = {
  field: keyof AgentDecision;
  requirement: string;
  actual: string;
  met: boolean;
};

/**
 * The price variance policy's automation conditions, each checked against a
 * decision, for display. Every criterion met is exactly SAFE_AUTOMATION.
 */
export function priceVarianceAutomationCriteria(
  decision: AgentDecision,
): AutomationCriterion[] {
  return [
    {
      field: "rootCause",
      requirement: "APPROVED_PO_AMENDMENT",
      actual: decision.rootCause,
      met: decision.rootCause === "APPROVED_PO_AMENDMENT",
    },
    {
      field: "recommendedAction",
      requirement: "REMATCH_USING_AMENDED_PO",
      actual: decision.recommendedAction,
      met: decision.recommendedAction === "REMATCH_USING_AMENDED_PO",
    },
    {
      field: "riskLevel",
      requirement: "LOW",
      actual: decision.riskLevel,
      met: decision.riskLevel === "LOW",
    },
    {
      field: "confidence",
      requirement: `≥ ${AUTOMATION_CONFIDENCE_THRESHOLD.toFixed(2)}`,
      actual: String(decision.confidence),
      met: decision.confidence >= AUTOMATION_CONFIDENCE_THRESHOLD,
    },
    {
      field: "requiresHumanReview",
      requirement: "false",
      actual: String(decision.requiresHumanReview),
      met: decision.requiresHumanReview === false,
    },
  ];
}

export const priceVarianceGovernancePolicy: GovernancePolicy<AgentDecision> = {
  n8nNode: "Apply Resolution Risk Policy",
  // The current n8n policy trusts the agent's rootCause. The fix is to verify
  // the PO amendment tool result deterministically before SAFE_AUTOMATION.
  verifiesToolEvidence: false,
  evaluate(decision) {
    const category = priceVarianceCategory(decision);
    return { category, reason: PRICE_VARIANCE_GOVERNANCE_REASONS[category] };
  },
};

// --- Registry -----------------------------------------------------------------

/** Governance policy for each exception type with an agent path. */
export const GOVERNANCE_POLICIES = {
  PRICE_VARIANCE: priceVarianceGovernancePolicy,
} as const satisfies Partial<
  Record<ExceptionType, GovernancePolicy<AgentDecision>>
>;

export function governancePolicyFor(exceptionType: ExceptionType) {
  const policy = (
    GOVERNANCE_POLICIES as Partial<
      Record<ExceptionType, GovernancePolicy<AgentDecision>>
    >
  )[exceptionType];
  if (!policy) {
    throw new Error(`No governance policy is registered for ${exceptionType}.`);
  }
  return policy;
}

/** Applies the exception type's policy to the final (resolution) agent step. */
export function applyGovernance(
  exceptionType: ExceptionType,
  agentSteps: readonly AgentStep[],
  now: Date = new Date(),
): Governance {
  const output = resolutionStep(agentSteps, exceptionType).output;
  const { category, reason } =
    governancePolicyFor(exceptionType).evaluate(output);
  return {
    automationAllowed: category === "SAFE_AUTOMATION",
    governanceCategory: category,
    governanceReason: reason,
    evaluatedAt: now.toISOString(),
  };
}

/** The price variance policy applied to a decision, shaped like the n8n node output. */
export function applyResolutionRiskPolicy(
  decision: AgentDecision,
  now: Date = new Date(),
): Governance {
  const { category, reason } = priceVarianceGovernancePolicy.evaluate(decision);
  return {
    automationAllowed: category === "SAFE_AUTOMATION",
    governanceCategory: category,
    governanceReason: reason,
    evaluatedAt: now.toISOString(),
  };
}
