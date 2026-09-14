import type { PoAmendmentLookup } from "@/lib/domain/resolution";
import { poAmendmentLookupFromWire } from "@/lib/n8n/convert";

// Port of the n8n "Lookup PO Amendment" Code node: the demo (non-evaluation)
// branch of the TOOL - Get PO Amendment workflow
// (n8n/code-nodes/lookup-po-amendment.js). It knows three evaluation POs;
// every other PO, including the demo batch's, returns NOT_FOUND. Verified by
// lookup-po-amendment.differential.test.ts.

type WireLookup = Parameters<typeof poAmendmentLookupFromWire>[0];

const AMENDMENTS: Record<string, WireLookup> = {
  "PO-EVAL-001": {
    lookupStatus: "FOUND",
    poNumber: "PO-EVAL-001",
    amendment: {
      amendmentId: "AMD-EVAL-001",
      poNumber: "PO-EVAL-001",
      status: "APPROVED",
      previousUnitPrice: 100,
      revisedUnitPrice: 110,
      currency: "USD",
      approvedBy: "Procurement Manager",
      approvalDate: "2026-08-28",
      reason: "Approved supplier rate adjustment",
    },
  },
  "PO-EVAL-002": {
    lookupStatus: "FOUND",
    poNumber: "PO-EVAL-002",
    amendment: {
      amendmentId: "AMD-EVAL-002",
      poNumber: "PO-EVAL-002",
      status: "PENDING",
      previousUnitPrice: 100,
      revisedUnitPrice: 110,
      currency: "USD",
      approvedBy: null,
      approvalDate: null,
      reason: "Supplier rate adjustment awaiting approval",
    },
  },
  "PO-EVAL-004": {
    lookupStatus: "LOOKUP_FAILED",
    poNumber: "PO-EVAL-004",
    amendment: null,
    error: {
      code: "ERP_API_UNAVAILABLE",
      message: "PO amendment service is temporarily unavailable",
    },
  },
};

export function lookupPoAmendment(poNumber: string): PoAmendmentLookup {
  return poAmendmentLookupFromWire(
    AMENDMENTS[poNumber] ?? {
      lookupStatus: "NOT_FOUND",
      poNumber,
      amendment: null,
    },
  );
}
