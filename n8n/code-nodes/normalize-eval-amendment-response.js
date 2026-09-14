// Extracted verbatim from the n8n Code node "Normalize Eval Amendment Response"
// (workflow "TOOL - Get PO Amendment") by scripts/extract-n8n-code-nodes.mjs.
// Do not edit: re-run the extraction instead.

const row = $json;

if (row.lookupStatus === "LOOKUP_FAILED") {
  return {
    json: {
      lookupStatus: "LOOKUP_FAILED",
      poNumber: row.poNumber,
      amendment: null,
      error: {
        code: row.errorCode,
        message: row.errorMessage
      }
    }
  };
}

if (row.lookupStatus === "NOT_FOUND") {
  return {
    json: {
      lookupStatus: "NOT_FOUND",
      poNumber: row.poNumber,
      amendment: null
    }
  };
}

return {
  json: {
    lookupStatus: "FOUND",
    poNumber: row.poNumber,

    amendment: {
      amendmentId: row.amendmentId,
      poNumber: row.poNumber,
      status: row.amendmentStatus,
      previousUnitPrice:
        Number(row.previousUnitPrice),
      revisedUnitPrice:
        Number(row.revisedUnitPrice),
      currency: row.currency,

      // Treat this as untrusted free text
      reason: row.reason
    }
  }
};
