const decision = $json.agentDecision;
const transaction = $json.transaction;
const verification = $json.verifiedAmendmentLookup;

if (!decision) {
  throw new Error(
    "Structured agent decision is missing"
  );
}


// ----------------------------------------
// DETERMINISTIC EVIDENCE VALIDATION
// The policy checks the authoritative PO amendment record itself,
// instead of trusting the root cause asserted by the agent.
//
// Failure types:
//   LOOKUP_FAILED  - evidence could not be retrieved (outage, missing
//                    result, or a result for a different PO)
//   CONTRADICTION  - the lookup succeeded, but the authoritative record
//                    does not support automation (no amendment, status
//                    not APPROVED, price or currency mismatch)
// ----------------------------------------

const toCents = (value) =>
  value === null || value === undefined || value === ""
    ? NaN
    : Math.round(Number(value) * 100);

const failures = [];

const fail = (type, check, message) =>
  failures.push({ type, check, message });

const invoice = transaction?.invoice || {};
const poNumber = transaction?.purchaseOrder?.poNumber;

if (!verification) {
  fail(
    "LOOKUP_FAILED",
    "lookupResult",
    "Authoritative PO amendment lookup result is missing."
  );
} else if (verification.lookupStatus === "LOOKUP_FAILED") {
  fail(
    "LOOKUP_FAILED",
    "lookupStatus",
    `PO amendment lookup failed (${verification.error?.code || "unknown error"}).`
  );
} else if (verification.poNumber !== poNumber) {
  fail(
    "LOOKUP_FAILED",
    "poNumber",
    `Lookup returned a result for ${verification.poNumber}, not the invoice's PO ${poNumber}.`
  );
} else if (verification.lookupStatus !== "FOUND") {
  fail(
    "CONTRADICTION",
    "lookupStatus",
    `PO amendment lookup returned ${verification.lookupStatus}: no amendment exists.`
  );
} else {
  const amendment = verification.amendment || {};

  if (amendment.status !== "APPROVED") {
    fail(
      "CONTRADICTION",
      "amendmentStatus",
      `Amendment status is ${amendment.status}, not APPROVED.`
    );
  }

  const revisedCents = toCents(amendment.revisedUnitPrice);
  if (
    !Number.isFinite(revisedCents) ||
    revisedCents !== toCents(invoice.unitPrice)
  ) {
    fail(
      "CONTRADICTION",
      "revisedUnitPrice",
      `Revised unit price ${amendment.revisedUnitPrice} does not equal invoice unit price ${invoice.unitPrice}.`
    );
  }

  if (amendment.currency !== invoice.currency) {
    fail(
      "CONTRADICTION",
      "currency",
      `Amendment currency ${amendment.currency} does not match invoice currency ${invoice.currency}.`
    );
  }
}

const evidenceOutcome =
  failures.length === 0
    ? "VERIFIED"
    : failures.some((f) => f.type === "LOOKUP_FAILED")
      ? "LOOKUP_FAILED"
      : "CONTRADICTION";


// ----------------------------------------
// AGENT RECOMMENDATION CRITERIA (unchanged)
// ----------------------------------------

const agentCriteriaMet =
  decision.rootCause === "APPROVED_PO_AMENDMENT" &&
  decision.recommendedAction === "REMATCH_USING_AMENDED_PO" &&
  decision.riskLevel === "LOW" &&
  decision.confidence >= 0.90 &&
  decision.requiresHumanReview === false;


let automationAllowed = false;
let governanceCategory = "";
let governanceReason = "";


// ----------------------------------------
// SAFE AUTOMATION: agent criteria AND verified evidence
// ----------------------------------------

if (agentCriteriaMet && evidenceOutcome === "VERIFIED") {

  automationAllowed = true;

  governanceCategory =
    "SAFE_AUTOMATION";

  governanceReason =
    "Approved PO amendment supports the invoice price and all low-risk automation criteria were satisfied.";
}


// ----------------------------------------
// TECHNICAL EXCEPTION (unchanged)
// ----------------------------------------

else if (
  decision.rootCause ===
    "TOOL_LOOKUP_FAILED" ||

  decision.recommendedAction ===
    "RETRY_LOOKUP"
) {

  automationAllowed = false;

  governanceCategory =
    "TECHNICAL_EXCEPTION";

  governanceReason =
    "Authoritative evidence could not be retrieved. Automated resolution is blocked until the lookup succeeds.";
}


// ----------------------------------------
// BUSINESS REVIEW
// ----------------------------------------

else {

  automationAllowed = false;

  governanceCategory =
    "BUSINESS_REVIEW_REQUIRED";

  if (agentCriteriaMet && evidenceOutcome === "LOOKUP_FAILED") {
    governanceReason =
      "The agent recommended automation, but the authoritative PO amendment record could not be retrieved to verify it; human review is required.";
  } else if (agentCriteriaMet && evidenceOutcome === "CONTRADICTION") {
    governanceReason =
      "The agent recommended automation, but the authoritative PO amendment record contradicts its claim; human review is required.";
  } else {
    governanceReason =
      "One or more automation criteria were not satisfied; human review is required.";
  }
}


return {
  json: {
    ...$json,

    governance: {
      automationAllowed,
      governanceCategory,
      governanceReason,
      evidenceVerification: {
        outcome: evidenceOutcome,
        verified: evidenceOutcome === "VERIFIED",
        agentClaimedAutomation: agentCriteriaMet,
        failures
      },
      evaluatedAt:
        new Date().toISOString()
    }
  }
};
