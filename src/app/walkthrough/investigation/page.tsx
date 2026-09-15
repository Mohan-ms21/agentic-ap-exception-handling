import { AgentStepsSequence, ToolCalls } from "@/components/agent-steps";
import { StepPage } from "@/components/step-page";
import { loadWalkthroughCase } from "@/lib/server/demo";

export default async function InvestigationStep() {
  const exceptionCase = await loadWalkthroughCase();

  return (
    <StepPage
      slug="investigation"
      lead="The agent investigates why the deterministic exception occurred. It decides whether to retrieve evidence and calls the PO Amendment tool, which returns the authoritative record."
    >
      <AgentStepsSequence
        steps={exceptionCase.agentSteps}
        renderStepBody={(step) => <ToolCalls step={step} />}
      />
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Demo data: the tool response comes from the ported n8n PO amendment
        lookup; no model was called.
      </p>
    </StepPage>
  );
}
