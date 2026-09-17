import { describe, expect, it } from "vitest";
import { poAmendmentLookupToWire, transactionToWire } from "@/lib/n8n/convert";
import { loadProposedN8nCodeNode } from "@/test-utils/n8n-code";
import { allEvalCases } from "@/lib/eval/eval-cases";
import { applyHardenedResolutionRiskPolicy } from "./governance-hardened";
import type { AgentDecision } from "./resolution";

// Runs the proposed n8n policy and its TypeScript port on the same inputs.

const proposed = loadProposedN8nCodeNode(
  "apply-resolution-risk-policy-hardened",
);
const cases = allEvalCases();

const fooled = (decision: AgentDecision): AgentDecision => ({
  ...decision,
  rootCause: "APPROVED_PO_AMENDMENT",
  recommendedAction: "REMATCH_USING_AMENDED_PO",
  riskLevel: "LOW",
  confidence: 0.95,
  requiresHumanReview: false,
});

const variants: [string, (d: AgentDecision) => AgentDecision][] = [
  ["answer key", (d) => d],
  ["fooled into claiming an approved amendment", fooled],
  [
    "just below the confidence threshold",
    (d) => ({ ...fooled(d), confidence: 0.89 }),
  ],
  [
    "retry lookup",
    (d) => ({
      ...d,
      rootCause: "TOOL_LOOKUP_FAILED",
      recommendedAction: "RETRY_LOOKUP",
    }),
  ],
];

describe("hardened policy vs the proposed n8n node", () => {
  it.each(variants)("agrees on every eval case: %s", (_, vary) => {
    for (const c of cases) {
      const decision = vary(c.agentDecision);
      const context = {
        transaction: c.transaction,
        verifiedAmendmentLookup: c.toolLookup,
      };
      const output = proposed({
        transaction: transactionToWire(c.transaction),
        agentDecision: decision,
        verifiedAmendmentLookup: poAmendmentLookupToWire(c.toolLookup),
      });
      const { evaluatedAt: _a, ...expected } = output.governance as Record<
        string,
        unknown
      >;
      const { evaluatedAt: _b, ...actual } = applyHardenedResolutionRiskPolicy(
        decision,
        context,
      );
      expect(actual, `${c.evaluationMeta.testCaseId}`).toEqual(expected);
    }
  });

  it("agrees when the policy's own lookup is missing or for another PO", () => {
    const c = cases[0];
    const decision = fooled(c.agentDecision);
    const wire = {
      transaction: transactionToWire(c.transaction),
      agentDecision: decision,
    };

    const { evaluatedAt: _a, ...expectedMissing } = proposed(wire)
      .governance as Record<string, unknown>;
    const { evaluatedAt: _b, ...actualMissing } =
      applyHardenedResolutionRiskPolicy(decision, {
        transaction: c.transaction,
        verifiedAmendmentLookup: null,
      });
    expect(actualMissing).toEqual(expectedMissing);

    const otherPo = {
      ...poAmendmentLookupToWire(c.toolLookup),
      poNumber: "PO-OTHER",
    };
    const { evaluatedAt: _c, ...expectedOther } = proposed({
      ...wire,
      verifiedAmendmentLookup: otherPo,
    }).governance as Record<string, unknown>;
    const { evaluatedAt: _d, ...actualOther } =
      applyHardenedResolutionRiskPolicy(decision, {
        transaction: c.transaction,
        verifiedAmendmentLookup: { ...c.toolLookup, poNumber: "PO-OTHER" },
      });
    expect(actualOther).toEqual(expectedOther);
  });
});
