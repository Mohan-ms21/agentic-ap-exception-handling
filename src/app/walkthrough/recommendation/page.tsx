import { AgentOutput } from "@/components/agent-output";
import { AgentStepsSequence } from "@/components/agent-steps";
import { StepPage } from "@/components/step-page";
import { loadWalkthroughCase } from "@/lib/server/demo";

export default async function RecommendationStep() {
  const exceptionCase = await loadWalkthroughCase();

  return (
    <StepPage
      slug="recommendation"
      lead="The agent returns a typed recommendation, constrained by a structured output schema, rather than free prose. It is a recommendation only: whether anything is automated is decided next, by policy."
    >
      <AgentStepsSequence
        steps={exceptionCase.agentSteps}
        renderStepBody={(step) => <AgentOutput step={step} />}
      />
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Demo data: this output is the example agent decision from Appendix A.2
        of the documentation; no model was called.
      </p>
    </StepPage>
  );
}
