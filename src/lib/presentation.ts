import type { BadgeTone } from "@/components/ui/badge";
import type { GovernanceCategory } from "@/lib/domain/governance";
import type { ExceptionType } from "@/lib/domain/matching";
import type { WorkflowStatus } from "@/lib/domain/workflow";

// Display labels. Wording follows section 24: the agent recommends and a
// deterministic policy authorizes; nothing says the AI approved or decided.

export const EXCEPTION_TYPE_LABELS: Record<ExceptionType, string> = {
  PRICE_VARIANCE: "Price variance",
  QUANTITY_VARIANCE: "Quantity variance",
  MISSING_RECEIPT: "Missing receipt",
  CURRENCY_MISMATCH: "Currency mismatch",
  PO_NOT_FOUND: "PO not found",
};

export const GOVERNANCE_LABELS: Record<
  GovernanceCategory,
  { label: string; tone: BadgeTone }
> = {
  SAFE_AUTOMATION: {
    label: "Safe automation · allowed by policy",
    tone: "success",
  },
  TECHNICAL_EXCEPTION: {
    label: "Technical exception · automation blocked",
    tone: "warning",
  },
  BUSINESS_REVIEW_REQUIRED: {
    label: "Business review required · automation blocked",
    tone: "info",
  },
};

export type ExecutionState = { label: string; tone: BadgeTone; detail: string };

/** How an invoice's child execution stands, in n8n terms (section 8.3). */
export function executionState(
  workflowStatus: WorkflowStatus | null,
): ExecutionState {
  switch (workflowStatus) {
    case "MATCHED":
      return {
        label: "Succeeded",
        tone: "success",
        detail: "Matched; continues to posting",
      };
    case "UNDER_AGENT_INVESTIGATION":
      return {
        label: "Running",
        tone: "accent",
        detail: "Agent investigating",
      };
    case "READY_FOR_AUTOMATED_RESOLUTION":
      return {
        label: "Succeeded",
        tone: "success",
        detail: "Automated resolution allowed by policy",
      };
    case "WAITING_FOR_HUMAN_REVIEW":
      return {
        label: "Waiting",
        tone: "warning",
        detail: "Paused for AP analyst review",
      };
    case "HUMAN_REVIEW_COMPLETED":
      return {
        label: "Succeeded",
        tone: "success",
        detail: "Analyst accepted the recommendation",
      };
    case "HUMAN_OVERRIDE":
      return {
        label: "Succeeded",
        tone: "success",
        detail: "Analyst overrode the recommendation",
      };
    case "ESCALATED":
      return {
        label: "Succeeded",
        tone: "success",
        detail: "Escalated to AP manager",
      };
    case null:
      return {
        label: "Stopped at routing",
        tone: "neutral",
        detail: "Detected; no investigation path yet",
      };
  }
}
