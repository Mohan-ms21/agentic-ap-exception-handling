import {
  AUTOMATION_CONFIDENCE_THRESHOLD,
  PRICE_VARIANCE_GOVERNANCE_REASONS,
  type EvidenceVerification,
  type Governance,
  type GovernanceCategory,
} from "./governance";
import { minorToMajor } from "./money";
import type { AgentDecision, PoAmendmentLookup } from "./resolution";
import type { Transaction } from "./transaction";

// Port of the PROPOSED hardened risk policy
// (n8n/proposed/apply-resolution-risk-policy-hardened.js), verified by
// governance-hardened.differential.test.ts.
//
// Not applied in n8n yet: the live workflow still runs the policy in
// src/lib/domain/governance.ts, which trusts the agent's asserted root
// cause. Anything shown from this policy must be labelled as proposed.

export const HARDENED_POLICY_STATUS = "PROPOSED" as const;

export type EvidenceContext = {
  transaction: Transaction;
  /** The policy's own PO amendment lookup; null when it could not run. */
  verifiedAmendmentLookup: PoAmendmentLookup | null;
};

export const HARDENED_GOVERNANCE_REASONS = {
  LOOKUP_FAILED:
    "The agent recommended automation, but the authoritative PO amendment record could not be retrieved to verify it; human review is required.",
  CONTRADICTION:
    "The agent recommended automation, but the authoritative PO amendment record contradicts its claim; human review is required.",
} as const;

type Failure = EvidenceVerification["failures"][number];

/** Compares in whole currency units x 100, as the n8n snippet does. */
const cents = (amountMinor: number, currency: string) =>
  Math.round(minorToMajor(amountMinor, currency) * 100);

/**
 * Checks the authoritative PO amendment record against the invoice, without
 * reference to what the agent concluded.
 */
export function verifyAmendmentEvidence(
  context: EvidenceContext,
): Omit<EvidenceVerification, "agentClaimedAutomation"> {
  const { transaction, verifiedAmendmentLookup: lookup } = context;
  const { invoice } = transaction;
  const poNumber = transaction.purchaseOrder?.poNumber;
  const failures: Failure[] = [];
  const fail = (type: Failure["type"], check: string, message: string) =>
    failures.push({ type, check, message });

  if (!lookup) {
    fail(
      "LOOKUP_FAILED",
      "lookupResult",
      "Authoritative PO amendment lookup result is missing.",
    );
  } else if (lookup.lookupStatus === "LOOKUP_FAILED") {
    fail(
      "LOOKUP_FAILED",
      "lookupStatus",
      `PO amendment lookup failed (${lookup.error.code}).`,
    );
  } else if (lookup.poNumber !== poNumber) {
    fail(
      "LOOKUP_FAILED",
      "poNumber",
      `Lookup returned a result for ${lookup.poNumber}, not the invoice's PO ${poNumber}.`,
    );
  } else if (lookup.lookupStatus !== "FOUND") {
    fail(
      "CONTRADICTION",
      "lookupStatus",
      `PO amendment lookup returned ${lookup.lookupStatus}: no amendment exists.`,
    );
  } else {
    const { amendment } = lookup;
    if (amendment.status !== "APPROVED") {
      fail(
        "CONTRADICTION",
        "amendmentStatus",
        `Amendment status is ${amendment.status}, not APPROVED.`,
      );
    }
    const revised = cents(amendment.revisedUnitPriceMinor, amendment.currency);
    if (revised !== cents(invoice.unitPriceMinor, invoice.currency)) {
      fail(
        "CONTRADICTION",
        "revisedUnitPrice",
        `Revised unit price ${minorToMajor(amendment.revisedUnitPriceMinor, amendment.currency)} does not equal invoice unit price ${minorToMajor(invoice.unitPriceMinor, invoice.currency)}.`,
      );
    }
    if (amendment.currency !== invoice.currency) {
      fail(
        "CONTRADICTION",
        "currency",
        `Amendment currency ${amendment.currency} does not match invoice currency ${invoice.currency}.`,
      );
    }
  }

  const outcome: EvidenceVerification["outcome"] =
    failures.length === 0
      ? "VERIFIED"
      : failures.some((f) => f.type === "LOOKUP_FAILED")
        ? "LOOKUP_FAILED"
        : "CONTRADICTION";

  return { outcome, verified: outcome === "VERIFIED", failures };
}

export function meetsAutomationCriteria(decision: AgentDecision): boolean {
  return (
    decision.rootCause === "APPROVED_PO_AMENDMENT" &&
    decision.recommendedAction === "REMATCH_USING_AMENDED_PO" &&
    decision.riskLevel === "LOW" &&
    decision.confidence >= AUTOMATION_CONFIDENCE_THRESHOLD &&
    decision.requiresHumanReview === false
  );
}

/** The proposed policy: agent criteria AND verified evidence. */
export function applyHardenedResolutionRiskPolicy(
  decision: AgentDecision,
  context: EvidenceContext,
  now: Date = new Date(),
): Governance {
  const evidence = verifyAmendmentEvidence(context);
  const agentClaimedAutomation = meetsAutomationCriteria(decision);

  let category: GovernanceCategory;
  let reason: string;
  if (agentClaimedAutomation && evidence.outcome === "VERIFIED") {
    category = "SAFE_AUTOMATION";
    reason = PRICE_VARIANCE_GOVERNANCE_REASONS.SAFE_AUTOMATION;
  } else if (
    decision.rootCause === "TOOL_LOOKUP_FAILED" ||
    decision.recommendedAction === "RETRY_LOOKUP"
  ) {
    category = "TECHNICAL_EXCEPTION";
    reason = PRICE_VARIANCE_GOVERNANCE_REASONS.TECHNICAL_EXCEPTION;
  } else {
    category = "BUSINESS_REVIEW_REQUIRED";
    reason = agentClaimedAutomation
      ? HARDENED_GOVERNANCE_REASONS[
          evidence.outcome === "LOOKUP_FAILED"
            ? "LOOKUP_FAILED"
            : "CONTRADICTION"
        ]
      : PRICE_VARIANCE_GOVERNANCE_REASONS.BUSINESS_REVIEW_REQUIRED;
  }

  return {
    automationAllowed: category === "SAFE_AUTOMATION",
    governanceCategory: category,
    governanceReason: reason,
    evidenceVerification: { ...evidence, agentClaimedAutomation },
    evaluatedAt: now.toISOString(),
  };
}
