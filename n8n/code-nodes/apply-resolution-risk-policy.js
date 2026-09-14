// Extracted verbatim from the n8n Code node "Apply Resolution Risk Policy"
// (workflow "AP Invoice processing") by scripts/extract-n8n-code-nodes.mjs.
// Do not edit: re-run the extraction instead.

const decision = $json.agentDecision;

if (!decision) {
  throw new Error(
    "Structured agent decision is missing"
  );
}

let automationAllowed = false;
let governanceCategory = "";
let governanceReason = "";


// ----------------------------------------
// SAFE AUTOMATION
// ----------------------------------------

if (
  decision.rootCause ===
    "APPROVED_PO_AMENDMENT" &&

  decision.recommendedAction ===
    "REMATCH_USING_AMENDED_PO" &&

  decision.riskLevel === "LOW" &&

  decision.confidence >= 0.90 &&

  decision.requiresHumanReview === false
) {

  automationAllowed = true;

  governanceCategory =
    "SAFE_AUTOMATION";

  governanceReason =
    "Approved PO amendment supports the invoice price and all low-risk automation criteria were satisfied.";
}


// ----------------------------------------
// TECHNICAL EXCEPTION
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

  governanceReason =
    "One or more automation criteria were not satisfied; human review is required.";
}


return {
  json: {
    ...$json,

    governance: {
      automationAllowed,
      governanceCategory,
      governanceReason,
      evaluatedAt:
        new Date().toISOString()
    }
  }
};
