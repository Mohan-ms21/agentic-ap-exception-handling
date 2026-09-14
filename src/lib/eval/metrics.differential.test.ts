import { describe, expect, it } from "vitest";
import { loadN8nCodeNode } from "@/test-utils/n8n-code";
import type { AgentDecision } from "@/lib/domain/resolution";
import type { Governance } from "@/lib/domain/governance";
import { allEvalCases } from "./eval-cases";
import { evaluationActualFrom, scoreEvaluationRow } from "./metrics";

// Runs the original n8n "Calculate Evaluation Metrics" node and the port on
// every eval case, with the answer-key decision and with variants that fail
// in different ways.

const original = loadN8nCodeNode("calculate-evaluation-metrics");

type Variant = [
  string,
  (d: AgentDecision, g: Governance) => [AgentDecision, Governance],
];

const variants: Variant[] = [
  ["answer key", (d, g) => [d, g]],
  [
    "fooled into automation",
    (d, g) => [
      {
        ...d,
        rootCause: "APPROVED_PO_AMENDMENT",
        recommendedAction: "REMATCH_USING_AMENDED_PO",
        riskLevel: "LOW",
        requiresHumanReview: false,
      },
      { ...g, automationAllowed: true, governanceCategory: "SAFE_AUTOMATION" },
    ],
  ],
  [
    "over-refusal",
    (d, g) => [
      {
        ...d,
        rootCause: "NO_AMENDMENT_FOUND",
        recommendedAction: "ROUTE_TO_BUYER",
        riskLevel: "MEDIUM",
        requiresHumanReview: true,
      },
      {
        ...g,
        automationAllowed: false,
        governanceCategory: "BUSINESS_REVIEW_REQUIRED",
      },
    ],
  ],
  ["no evidence", (d, g) => [{ ...d, evidence: [] }, g]],
  ["wrong risk", (d, g) => [{ ...d, riskLevel: "HIGH" }, g]],
  [
    "technical",
    (d, g) => [
      {
        ...d,
        rootCause: "TOOL_LOOKUP_FAILED",
        recommendedAction: "RETRY_LOOKUP",
      },
      {
        ...g,
        automationAllowed: false,
        governanceCategory: "TECHNICAL_EXCEPTION",
      },
    ],
  ],
];

describe("evaluation metrics vs original n8n node", () => {
  const cases = allEvalCases();

  it.each(variants)("agrees on every eval case: %s", (_, vary) => {
    for (const c of cases) {
      const [agentDecision, governance] = vary(c.agentDecision, c.governance);
      const output = original({
        evaluationMeta: c.evaluationMeta,
        evaluationExpected: c.evaluationExpected,
        agentDecision,
        governance,
      });
      const actual = evaluationActualFrom(agentDecision, governance);
      expect(actual, c.evaluationMeta.testCaseId).toEqual(
        output.evaluationActual,
      );
      expect(
        scoreEvaluationRow(
          c.evaluationExpected,
          actual,
          c.evaluationMeta.suite,
        ),
        c.evaluationMeta.testCaseId,
      ).toEqual(output.evaluationMetrics);
    }
  });

  it.each([
    ["root cause", { forbidRootCause: true, forbidAction: false }],
    ["action", { forbidRootCause: false, forbidAction: true }],
  ])(
    "agrees when the answer key forbids only its own expected %s",
    (_, { forbidRootCause, forbidAction }) => {
      // Not a realistic dataset row: forbidding the expected outcome isolates
      // each red-team condition, so the port matches the node's logic exactly,
      // including conditions that are redundant for consistent answer keys.
      for (const c of cases.filter(
        (x) => x.evaluationMeta.suite === "RED_TEAM",
      )) {
        const evaluationExpected = {
          ...c.evaluationExpected,
          forbiddenRootCause: forbidRootCause
            ? c.evaluationExpected.rootCause
            : null,
          forbiddenAction: forbidAction
            ? c.evaluationExpected.recommendedAction
            : null,
        };
        const output = original({
          evaluationMeta: c.evaluationMeta,
          evaluationExpected,
          agentDecision: c.agentDecision,
          governance: c.governance,
        });
        const actual = evaluationActualFrom(c.agentDecision, c.governance);
        expect(
          scoreEvaluationRow(evaluationExpected, actual, "RED_TEAM"),
        ).toEqual(output.evaluationMetrics);
      }
    },
  );
});
