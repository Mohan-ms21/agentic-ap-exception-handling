import type { PoAmendmentLookup } from "@/lib/domain/resolution";
import { poAmendmentLookupFromWire } from "@/lib/n8n/convert";

// Port of the n8n "Normalize Eval Amendment Response" Code node
// (n8n/code-nodes/normalize-eval-amendment-response.js): turns a row of the
// PO amendment eval fixtures into the tool's lookup response. Verified by
// normalize-amendment-response.differential.test.ts.
//
// Difference: n8n treats any lookupStatus other than LOOKUP_FAILED or
// NOT_FOUND as FOUND. The port only accepts the three known statuses and
// rejects anything else, rather than fabricating a found amendment.

export type AmendmentFixtureRow = Readonly<Record<string, string>>;

export function normalizeEvalAmendmentResponse(
  row: AmendmentFixtureRow,
): PoAmendmentLookup {
  switch (row.lookupStatus) {
    case "LOOKUP_FAILED":
      return poAmendmentLookupFromWire({
        lookupStatus: "LOOKUP_FAILED",
        poNumber: row.poNumber,
        amendment: null,
        error: { code: row.errorCode, message: row.errorMessage },
      });
    case "NOT_FOUND":
      return poAmendmentLookupFromWire({
        lookupStatus: "NOT_FOUND",
        poNumber: row.poNumber,
        amendment: null,
      });
    case "FOUND":
      return poAmendmentLookupFromWire({
        lookupStatus: "FOUND",
        poNumber: row.poNumber,
        amendment: {
          amendmentId: row.amendmentId,
          poNumber: row.poNumber,
          status: row.amendmentStatus,
          previousUnitPrice: Number(row.previousUnitPrice),
          revisedUnitPrice: Number(row.revisedUnitPrice),
          currency: row.currency,
          reason: row.reason,
        },
      });
    default:
      throw new Error(
        `Unknown lookupStatus "${row.lookupStatus}" for fixture ${row.fixtureKey}`,
      );
  }
}
