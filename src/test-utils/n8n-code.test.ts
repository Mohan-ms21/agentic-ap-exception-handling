import { describe, expect, it } from "vitest";
import { loadN8nCodeNode, loadPatchedN8nCodeNode } from "./n8n-code";

describe("n8n Code node harness", () => {
  it("runs an original node against $json and unwraps { json }", () => {
    const riskPolicy = loadN8nCodeNode("apply-resolution-risk-policy");
    const output = riskPolicy({
      agentDecision: {
        rootCause: "NO_AMENDMENT_FOUND",
        recommendedAction: "ROUTE_TO_BUYER",
        riskLevel: "MEDIUM",
        confidence: 0.9,
        requiresHumanReview: true,
      },
    });
    expect(output.governance).toMatchObject({
      automationAllowed: false,
      governanceCategory: "BUSINESS_REVIEW_REQUIRED",
    });
  });

  it("does not let a node mutate the caller's input", () => {
    const matching = loadN8nCodeNode("deterministic-matching-engine");
    const input = {
      transaction: {
        invoice: {
          invoiceId: "INV-1",
          currency: "USD",
          quantity: 1,
          unitPrice: 1,
        },
        purchaseOrder: null,
        goodsReceipt: null,
        matchingPolicy: {
          matchType: "TWO_WAY",
          priceTolerancePct: 0,
          quantityTolerancePct: 0,
        },
      },
    };
    const before = structuredClone(input);
    matching(input);
    expect(input).toEqual(before);
  });

  it("refuses a patch that changes nothing", () => {
    expect(() =>
      loadPatchedN8nCodeNode("apply-resolution-risk-policy", (s) => s),
    ).toThrow(/did not change/);
  });
});
