import { Badge } from "@/components/ui/badge";
import { CodeValue } from "@/components/ui/code-value";
import { KeyValues } from "@/components/ui/key-values";
import type { AgentStep } from "@/lib/domain/agent-steps";

/** Renders a step's structured output with the renderer for its schema. */
export function AgentOutput({ step }: { step: AgentStep }) {
  switch (step.outputSchemaId) {
    case "PRICE_VARIANCE_RESOLUTION": {
      const output = step.output;
      return (
        <div className="space-y-4">
          <KeyValues
            items={[
              {
                label: "rootCause",
                value: <CodeValue>{output.rootCause}</CodeValue>,
              },
              {
                label: "recommendedAction",
                value: <CodeValue>{output.recommendedAction}</CodeValue>,
              },
              {
                label: "riskLevel",
                value: <CodeValue>{output.riskLevel}</CodeValue>,
              },
              {
                label: "requiresHumanReview",
                value: (
                  <CodeValue>{String(output.requiresHumanReview)}</CodeValue>
                ),
              },
              {
                label: "confidence",
                value: (
                  <span className="flex flex-wrap items-center gap-2">
                    <CodeValue>{output.confidence}</CodeValue>
                    <span className="text-xs text-neutral-500">
                      a signal from the model, not authorization
                    </span>
                  </span>
                ),
              },
            ]}
          />
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              evidence (as stated by the agent)
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {output.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              explanation
            </p>
            <p className="mt-1 text-sm">{output.explanation}</p>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Output schema <Badge>{step.outputSchemaId}</Badge> · the n8n
            Exception Resolution Output Schema
          </p>
        </div>
      );
    }
  }
}
