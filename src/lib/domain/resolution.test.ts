import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  agentDecisionSchema,
  isApprovedAmendment,
  poAmendmentLookupSchema,
  type PoAmendment,
} from "./resolution";

const n8nOutputSchema = JSON.parse(
  readFileSync(
    join(
      __dirname,
      "../../../n8n/schemas/exception-resolution-output-schema.json",
    ),
    "utf8",
  ),
);

const decision = {
  rootCause: "APPROVED_PO_AMENDMENT",
  recommendedAction: "REMATCH_USING_AMENDED_PO",
  riskLevel: "LOW",
  confidence: 0.95,
  evidence: ["Amendment AMD-EVAL-001 is APPROVED at 110 USD."],
  requiresHumanReview: false,
  explanation: "Approved amendment explains the variance.",
};

describe("agentDecisionSchema", () => {
  it("is exactly the n8n Exception Resolution Output Schema", () => {
    const { $schema, ...generated } = z.toJSONSchema(agentDecisionSchema);
    expect($schema).toBeDefined();
    expect(generated).toEqual(n8nOutputSchema);
  });

  it("rejects additional properties, as the n8n schema does", () => {
    expect(
      agentDecisionSchema.safeParse({ ...decision, extra: 1 }).success,
    ).toBe(false);
  });

  it("bounds confidence to 0-1 inclusive", () => {
    for (const confidence of [0, 0.89, 0.9, 1]) {
      expect(
        agentDecisionSchema.safeParse({ ...decision, confidence }).success,
      ).toBe(true);
    }
    for (const confidence of [-0.01, 1.01]) {
      expect(
        agentDecisionSchema.safeParse({ ...decision, confidence }).success,
      ).toBe(false);
    }
  });
});

describe("PO amendment lookup", () => {
  const amendment: PoAmendment = {
    amendmentId: "AMD-RT-006",
    poNumber: "PO-RT-006",
    status: "PENDING_APPROVAL",
    previousUnitPriceMinor: 10000,
    revisedUnitPriceMinor: 11000,
    currency: "USD",
    reason: "Awaiting final approval",
  };

  it("accepts near-miss statuses but treats only exactly APPROVED as approved", () => {
    expect(
      poAmendmentLookupSchema.safeParse({
        lookupStatus: "FOUND",
        poNumber: "PO-RT-006",
        amendment,
      }).success,
    ).toBe(true);
    expect(isApprovedAmendment(amendment)).toBe(false);
    expect(isApprovedAmendment({ ...amendment, status: "approved" })).toBe(
      false,
    );
    expect(isApprovedAmendment({ ...amendment, status: "APPROVED " })).toBe(
      false,
    );
    expect(isApprovedAmendment({ ...amendment, status: "APPROVED" })).toBe(
      true,
    );
  });

  it("requires an error for a failed lookup and no amendment", () => {
    expect(
      poAmendmentLookupSchema.safeParse({
        lookupStatus: "LOOKUP_FAILED",
        poNumber: "PO-EVAL-004",
        amendment: null,
      }).success,
    ).toBe(false);
  });
});
