import { describe, expect, it } from "vitest";
import { loadN8nCodeNode } from "@/test-utils/n8n-code";
import { applyResolutionRiskPolicy } from "./governance";
import {
  recommendedActionSchema,
  riskLevelSchema,
  rootCauseSchema,
  type AgentDecision,
} from "./resolution";

// Runs the original n8n "Apply Resolution Risk Policy" node and the port on
// every combination of decision fields and compares the governance output.

const original = loadN8nCodeNode("apply-resolution-risk-policy");

const confidences = [
  0, 0.1, 0.5, 0.85, 0.89, 0.8999999999999999, 0.9, 0.9, 0.9000000000000001,
  0.95, 0.99, 1,
];

function* decisions(): Generator<AgentDecision> {
  for (const rootCause of rootCauseSchema.options)
    for (const recommendedAction of recommendedActionSchema.options)
      for (const riskLevel of riskLevelSchema.options)
        for (const confidence of confidences)
          for (const requiresHumanReview of [true, false])
            yield {
              rootCause,
              recommendedAction,
              riskLevel,
              confidence,
              requiresHumanReview,
              evidence: ["evidence"],
              explanation: "explanation",
            };
}

describe("resolution risk policy vs original n8n node", () => {
  it("agrees on every combination of root cause, action, risk, confidence and review flag", () => {
    let compared = 0;
    for (const decision of decisions()) {
      const { evaluatedAt: originalAt, ...expected } = original({
        agentDecision: decision,
      }).governance as Record<string, unknown>;
      const { evaluatedAt, ...actual } = applyResolutionRiskPolicy(decision);
      expect(actual, JSON.stringify(decision)).toEqual(expected);
      expect(typeof originalAt).toBe("string");
      expect(typeof evaluatedAt).toBe("string");
      compared++;
    }
    expect(compared).toBe(6 * 4 * 3 * confidences.length * 2);
  });

  it("keeps the rest of the item unchanged, as the n8n node does", () => {
    const item = { caseId: "EXC-1", agentDecision: [...decisions()][0] };
    const output = original(item);
    expect(output.caseId).toBe("EXC-1");
    expect(output.agentDecision).toEqual(item.agentDecision);
  });

  it("fails like the n8n node when the decision is missing", () => {
    expect(() => original({})).toThrow("Structured agent decision is missing");
  });
});
