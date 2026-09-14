import { describe, expect, it } from "vitest";
import {
  AGENT_OUTPUT_SCHEMAS,
  agentStepSchema,
  PRICE_VARIANCE_AGENT,
  RESOLUTION_OUTPUT_SCHEMA_BY_EXCEPTION_TYPE,
  resolutionStep,
  type AgentStep,
} from "./agent-steps";
import { agentDecisionSchema, type AgentDecision } from "./resolution";

const decision: AgentDecision = {
  rootCause: "NO_AMENDMENT_FOUND",
  recommendedAction: "ROUTE_TO_BUYER",
  riskLevel: "MEDIUM",
  confidence: 1,
  evidence: ["PO amendment lookup returned NOT_FOUND."],
  requiresHumanReview: true,
  explanation: "No approved amendment was found to explain the variance.",
};

const step: AgentStep = {
  ...PRICE_VARIANCE_AGENT,
  toolCalls: [
    {
      toolName: "Get PO Amendment",
      input: { poNumber: "PO-3002" },
      response: {
        lookupStatus: "NOT_FOUND",
        poNumber: "PO-3002",
        amendment: null,
      },
    },
  ],
  startedAt: "2026-09-01T09:00:00.000Z",
  completedAt: "2026-09-01T09:00:12.000Z",
  outputSchemaId: "PRICE_VARIANCE_RESOLUTION",
  output: decision,
};

describe("output schema registry", () => {
  it("registers the n8n Exception Resolution Output Schema for price variance", () => {
    expect(RESOLUTION_OUTPUT_SCHEMA_BY_EXCEPTION_TYPE.PRICE_VARIANCE).toBe(
      "PRICE_VARIANCE_RESOLUTION",
    );
    expect(AGENT_OUTPUT_SCHEMAS.PRICE_VARIANCE_RESOLUTION).toBe(
      agentDecisionSchema,
    );
  });

  it("has no agent resolution schema for exception types without an investigation path", () => {
    for (const type of [
      "QUANTITY_VARIANCE",
      "MISSING_RECEIPT",
      "CURRENCY_MISMATCH",
      "PO_NOT_FOUND",
    ] as const) {
      expect(RESOLUTION_OUTPUT_SCHEMA_BY_EXCEPTION_TYPE[type]).toBeUndefined();
    }
  });
});

describe("agentStepSchema", () => {
  it("accepts a price variance step with its tool call", () => {
    expect(agentStepSchema.safeParse(step).success).toBe(true);
  });

  it("validates the output against the schema its id names", () => {
    const bad = { ...step, output: { ...decision, rootCause: "PAID_ALREADY" } };
    expect(agentStepSchema.safeParse(bad).success).toBe(false);
  });

  it("allows backends that do not record tool calls or timings", () => {
    const n8nStep = {
      ...step,
      toolCalls: null,
      startedAt: null,
      completedAt: null,
    };
    expect(agentStepSchema.safeParse(n8nStep).success).toBe(true);
  });
});

describe("resolutionStep", () => {
  it("returns the final step when it produces the type's resolution schema", () => {
    expect(resolutionStep([step], "PRICE_VARIANCE").output).toEqual(decision);
  });

  it("rejects an exception type with no registered resolution schema", () => {
    expect(() => resolutionStep([step], "PO_NOT_FOUND")).toThrow(
      /No agent resolution schema/,
    );
  });

  it("rejects an empty step list", () => {
    expect(() => resolutionStep([], "PRICE_VARIANCE")).toThrow(/no steps/);
  });
});
