import { describe, expect, it } from "vitest";
import { poAmendmentLookupToWire } from "@/lib/n8n/convert";
import { loadN8nCodeNode } from "@/test-utils/n8n-code";
import { lookupPoAmendment } from "./lookup-po-amendment";

const original = loadN8nCodeNode("lookup-po-amendment");

describe("lookupPoAmendment vs original n8n node", () => {
  it.each([
    "PO-EVAL-001",
    "PO-EVAL-002",
    "PO-EVAL-004",
    "PO-3002",
    "PO-9999",
    "PO-EVAL-003",
  ])("returns the same tool response for %s", (poNumber) => {
    expect(poAmendmentLookupToWire(lookupPoAmendment(poNumber))).toEqual(
      original({ poNumber }),
    );
  });

  it("returns NOT_FOUND for the demo batch's price variance PO (walkthrough 31.5)", () => {
    expect(lookupPoAmendment("PO-3002")).toEqual({
      lookupStatus: "NOT_FOUND",
      poNumber: "PO-3002",
      amendment: null,
    });
  });
});
