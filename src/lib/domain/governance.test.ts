import { describe, expect, it } from "vitest";
import {
  governanceSchema,
  priceVarianceAutomationCriteria,
  applyGovernance,
  applyResolutionRiskPolicy,
  GOVERNANCE_POLICIES,
  governancePolicyFor,
  priceVarianceGovernancePolicy,
  PRICE_VARIANCE_GOVERNANCE_REASONS,
  type GovernanceCategory,
} from "./governance";
import {
  recommendedActionSchema,
  riskLevelSchema,
  rootCauseSchema,
  type AgentDecision,
} from "./resolution";

const safeDecision: AgentDecision = {
  rootCause: "APPROVED_PO_AMENDMENT",
  recommendedAction: "REMATCH_USING_AMENDED_PO",
  riskLevel: "LOW",
  confidence: 0.9,
  evidence: ["Amendment AMD-EVAL-001 is APPROVED at 110 USD."],
  requiresHumanReview: false,
  explanation: "Approved amendment explains the variance.",
};

const categoryOf = (decision: AgentDecision) =>
  applyResolutionRiskPolicy(decision).governanceCategory;

describe("confidence threshold", () => {
  it("allows automation at exactly 0.90", () => {
    expect(
      applyResolutionRiskPolicy({ ...safeDecision, confidence: 0.9 }),
    ).toMatchObject({
      automationAllowed: true,
      governanceCategory: "SAFE_AUTOMATION",
    });
  });

  it("blocks automation at 0.89 and routes to business review", () => {
    expect(
      applyResolutionRiskPolicy({ ...safeDecision, confidence: 0.89 }),
    ).toMatchObject({
      automationAllowed: false,
      governanceCategory: "BUSINESS_REVIEW_REQUIRED",
    });
  });

  it("is inclusive at 0.9 down to the adjacent floating-point values", () => {
    const justBelow = 0.8999999999999999; // largest double below 0.9
    const justAbove = 0.9000000000000001; // smallest double above 0.9
    expect(justBelow).toBeLessThan(0.9);
    expect(categoryOf({ ...safeDecision, confidence: justBelow })).toBe(
      "BUSINESS_REVIEW_REQUIRED",
    );
    expect(categoryOf({ ...safeDecision, confidence: justAbove })).toBe(
      "SAFE_AUTOMATION",
    );
    expect(categoryOf({ ...safeDecision, confidence: 1 })).toBe(
      "SAFE_AUTOMATION",
    );
  });
});

describe("safe automation requires every criterion", () => {
  it.each<[string, Partial<AgentDecision>]>([
    [
      "root cause is not APPROVED_PO_AMENDMENT",
      { rootCause: "OTHER_SUPPORTED_CAUSE" },
    ],
    [
      "action is not REMATCH_USING_AMENDED_PO",
      { recommendedAction: "HUMAN_REVIEW" },
    ],
    ["risk is MEDIUM", { riskLevel: "MEDIUM" }],
    ["risk is HIGH", { riskLevel: "HIGH" }],
    ["confidence is below 0.90", { confidence: 0.5 }],
    ["the agent asks for human review", { requiresHumanReview: true }],
  ])("requires business review when %s", (_, change) => {
    expect(
      applyResolutionRiskPolicy({ ...safeDecision, ...change }),
    ).toMatchObject({
      automationAllowed: false,
      governanceCategory: "BUSINESS_REVIEW_REQUIRED",
    });
  });
});

describe("technical exceptions", () => {
  it.each(recommendedActionSchema.options)(
    "blocks automation when the lookup failed, whatever the action (%s)",
    (recommendedAction) => {
      expect(
        categoryOf({
          ...safeDecision,
          rootCause: "TOOL_LOOKUP_FAILED",
          recommendedAction,
        }),
      ).toBe("TECHNICAL_EXCEPTION");
    },
  );

  it.each(rootCauseSchema.options)(
    "blocks automation when the action is RETRY_LOOKUP, whatever the root cause (%s)",
    (rootCause) => {
      expect(
        categoryOf({
          ...safeDecision,
          rootCause,
          recommendedAction: "RETRY_LOOKUP",
        }),
      ).toBe("TECHNICAL_EXCEPTION");
    },
  );
});

describe("policy invariants over every combination", () => {
  const confidences = [0, 0.5, 0.89, 0.8999999999999999, 0.9, 0.95, 1];

  it("assigns exactly one category, automating only when all five criteria hold", () => {
    let count = 0;
    for (const rootCause of rootCauseSchema.options)
      for (const recommendedAction of recommendedActionSchema.options)
        for (const riskLevel of riskLevelSchema.options)
          for (const confidence of confidences)
            for (const requiresHumanReview of [true, false]) {
              const decision = {
                ...safeDecision,
                rootCause,
                recommendedAction,
                riskLevel,
                confidence,
                requiresHumanReview,
              };
              const governance = applyResolutionRiskPolicy(decision);
              const allCriteria =
                rootCause === "APPROVED_PO_AMENDMENT" &&
                recommendedAction === "REMATCH_USING_AMENDED_PO" &&
                riskLevel === "LOW" &&
                confidence >= 0.9 &&
                !requiresHumanReview;
              const technical =
                rootCause === "TOOL_LOOKUP_FAILED" ||
                recommendedAction === "RETRY_LOOKUP";
              const expected: GovernanceCategory = allCriteria
                ? "SAFE_AUTOMATION"
                : technical
                  ? "TECHNICAL_EXCEPTION"
                  : "BUSINESS_REVIEW_REQUIRED";

              expect(governance.governanceCategory).toBe(expected);
              expect(governance.automationAllowed).toBe(
                expected === "SAFE_AUTOMATION",
              );
              expect(governance.governanceReason).toBe(
                PRICE_VARIANCE_GOVERNANCE_REASONS[expected],
              );
              count++;
            }
    expect(count).toBe(6 * 4 * 3 * confidences.length * 2);
  });
});

it("uses the n8n node's reason text and the supplied clock", () => {
  const now = new Date("2026-09-01T09:02:00.000Z");
  expect(
    applyResolutionRiskPolicy({ ...safeDecision, riskLevel: "HIGH" }, now),
  ).toEqual({
    automationAllowed: false,
    governanceCategory: "BUSINESS_REVIEW_REQUIRED",
    governanceReason:
      "One or more automation criteria were not satisfied; human review is required.",
    evaluatedAt: "2026-09-01T09:02:00.000Z",
  });
});

describe("policy registry", () => {
  const step = {
    agentName: "Price Variance Investigation Agent",
    objective: "Investigate.",
    toolCalls: null,
    startedAt: null,
    completedAt: null,
    outputSchemaId: "PRICE_VARIANCE_RESOLUTION" as const,
    output: safeDecision,
  };

  it("registers the ported n8n rule as the price variance policy", () => {
    expect(GOVERNANCE_POLICIES.PRICE_VARIANCE).toBe(
      priceVarianceGovernancePolicy,
    );
    expect(governancePolicyFor("PRICE_VARIANCE").n8nNode).toBe(
      "Apply Resolution Risk Policy",
    );
  });

  it("records that the current policy does not verify tool evidence", () => {
    expect(priceVarianceGovernancePolicy.verifiesToolEvidence).toBe(false);
  });

  it("applies the policy for the exception type to the resolution step", () => {
    const now = new Date("2026-09-01T09:02:00.000Z");
    expect(applyGovernance("PRICE_VARIANCE", [step], now)).toEqual(
      applyResolutionRiskPolicy(safeDecision, now),
    );
  });

  it("has no policy for exception types without an agent path", () => {
    expect(() => governancePolicyFor("QUANTITY_VARIANCE")).toThrow(
      /No governance policy/,
    );
  });
});

describe("governanceSchema", () => {
  const base = {
    automationAllowed: false,
    governanceCategory: "BUSINESS_REVIEW_REQUIRED",
    governanceReason:
      "The agent recommended automation, but the authoritative PO amendment record contradicts its claim; human review is required.",
    evaluatedAt: "2026-09-15T08:00:00.000Z",
  };

  it("keeps the hardened policy's evidence verification rather than stripping it", () => {
    const evidenceVerification = {
      outcome: "CONTRADICTION",
      verified: false,
      agentClaimedAutomation: true,
      failures: [
        {
          type: "CONTRADICTION",
          check: "amendmentStatus",
          message: "Amendment status is PENDING, not APPROVED.",
        },
      ],
    };
    expect(
      governanceSchema.parse({ ...base, evidenceVerification })
        .evidenceVerification,
    ).toEqual(evidenceVerification);
  });

  it("accepts the current policy's output, which has no evidence verification", () => {
    expect(governanceSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an unknown failure type", () => {
    const result = governanceSchema.safeParse({
      ...base,
      evidenceVerification: {
        outcome: "CONTRADICTION",
        verified: false,
        agentClaimedAutomation: true,
        failures: [{ type: "OUTAGE", check: "lookupStatus", message: "down" }],
      },
    });
    expect(result.success).toBe(false);
  });
});

describe("priceVarianceAutomationCriteria", () => {
  it("lists the five conditions with the decision's values", () => {
    expect(
      priceVarianceAutomationCriteria({ ...safeDecision, confidence: 0.89 }),
    ).toEqual([
      {
        field: "rootCause",
        requirement: "APPROVED_PO_AMENDMENT",
        actual: "APPROVED_PO_AMENDMENT",
        met: true,
      },
      {
        field: "recommendedAction",
        requirement: "REMATCH_USING_AMENDED_PO",
        actual: "REMATCH_USING_AMENDED_PO",
        met: true,
      },
      { field: "riskLevel", requirement: "LOW", actual: "LOW", met: true },
      {
        field: "confidence",
        requirement: "≥ 0.90",
        actual: "0.89",
        met: false,
      },
      {
        field: "requiresHumanReview",
        requirement: "false",
        actual: "false",
        met: true,
      },
    ]);
  });

  it("has every criterion met exactly when the policy allows automation", () => {
    for (const rootCause of rootCauseSchema.options)
      for (const recommendedAction of recommendedActionSchema.options)
        for (const riskLevel of riskLevelSchema.options)
          for (const confidence of [0.5, 0.89, 0.8999999999999999, 0.9, 1])
            for (const requiresHumanReview of [true, false]) {
              const decision = {
                ...safeDecision,
                rootCause,
                recommendedAction,
                riskLevel,
                confidence,
                requiresHumanReview,
              };
              expect(
                priceVarianceAutomationCriteria(decision).every((c) => c.met),
              ).toBe(applyResolutionRiskPolicy(decision).automationAllowed);
            }
  });
});
