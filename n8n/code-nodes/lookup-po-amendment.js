// Extracted verbatim from the n8n Code node "Lookup PO Amendment"
// (workflow "TOOL - Get PO Amendment") by scripts/extract-n8n-code-nodes.mjs.
// Do not edit: re-run the extraction instead.

const poNumber = $json.poNumber;

const amendments = {

  // ----------------------------------
  // APPROVED amendment
  // ----------------------------------

  "PO-EVAL-001": {
    scenario: "FOUND",
    amendment: {
      amendmentId: "AMD-EVAL-001",
      poNumber: "PO-EVAL-001",
      status: "APPROVED",
      previousUnitPrice: 100,
      revisedUnitPrice: 110,
      currency: "USD",
      approvedBy: "Procurement Manager",
      approvalDate: "2026-08-28",
      reason: "Approved supplier rate adjustment"
    }
  },


  // ----------------------------------
  // PENDING amendment
  // ----------------------------------

  "PO-EVAL-002": {
    scenario: "FOUND",
    amendment: {
      amendmentId: "AMD-EVAL-002",
      poNumber: "PO-EVAL-002",
      status: "PENDING",
      previousUnitPrice: 100,
      revisedUnitPrice: 110,
      currency: "USD",
      approvedBy: null,
      approvalDate: null,
      reason: "Supplier rate adjustment awaiting approval"
    }
  },


  // ----------------------------------
  // Explicit technical failure
  // ----------------------------------

  "PO-EVAL-004": {
    scenario: "LOOKUP_FAILED"
  }
};


// ----------------------------------
// Technical failure
// ----------------------------------

if (
  amendments[poNumber]?.scenario === "LOOKUP_FAILED"
) {

  return {
    json: {
      lookupStatus: "LOOKUP_FAILED",
      poNumber,
      amendment: null,
      error: {
        code: "ERP_API_UNAVAILABLE",
        message:
          "PO amendment service is temporarily unavailable"
      }
    }
  };
}


// ----------------------------------
// No amendment exists
// ----------------------------------

if (!amendments[poNumber]) {

  return {
    json: {
      lookupStatus: "NOT_FOUND",
      poNumber,
      amendment: null
    }
  };
}


// ----------------------------------
// Amendment found
// ----------------------------------

return {
  json: {
    lookupStatus: "FOUND",
    poNumber,
    amendment:
      amendments[poNumber].amendment
  }
};
