import {
  agentStepSchema,
  PRICE_VARIANCE_AGENT,
  type AgentStep,
} from "@/lib/domain/agent-steps";
import type { AgentDecision } from "@/lib/domain/resolution";
import { lookupPoAmendment } from "./lookup-po-amendment";

// Stand-in for the n8n "Price Variance Investigation Agent" on the demo
// batch. Not a model: the output is written by hand. For INV-3002 it is the
// agent decision from Appendix A.2 of the solution documentation, which is
// the result shown in the walkthrough (section 31.5).

const DEMO_OUTPUTS: Record<string, AgentDecision> = {
  "INV-3002": {
    rootCause: "NO_AMENDMENT_FOUND",
    recommendedAction: "ROUTE_TO_BUYER",
    riskLevel: "MEDIUM",
    confidence: 1,
    evidence: ["PO amendment lookup returned NOT_FOUND."],
    requiresHumanReview: true,
    explanation: "No approved amendment was found to explain the variance.",
  },
};

export function demoAgentStep(
  invoiceId: string,
  poNumber: string,
  times: { startedAt: Date; completedAt: Date },
): AgentStep {
  const output = DEMO_OUTPUTS[invoiceId];
  if (!output) {
    throw new Error(`No demo agent output for ${invoiceId}`);
  }
  return agentStepSchema.parse({
    ...PRICE_VARIANCE_AGENT,
    toolCalls: [
      {
        toolName: "Get PO Amendment",
        input: { poNumber },
        response: lookupPoAmendment(poNumber),
      },
    ],
    startedAt: times.startedAt.toISOString(),
    completedAt: times.completedAt.toISOString(),
    outputSchemaId: "PRICE_VARIANCE_RESOLUTION",
    output,
  });
}
