import Link from "next/link";
import { StepPage } from "@/components/step-page";
import { Panel } from "@/components/ui/panel";
import { stepHref } from "@/lib/walkthrough";

const RECAP = [
  {
    stage: "Detect",
    text: "The matching engine calculated the variance and routed the exception.",
    step: "matching",
  },
  {
    stage: "Investigate",
    text: "The agent used one granted tool to retrieve authoritative evidence and recommended an action.",
    step: "investigation",
  },
  {
    stage: "Govern",
    text: "A deterministic policy, not the model's confidence, decided that automation was not allowed.",
    step: "governance",
  },
  {
    stage: "Act",
    text: "An analyst accepted, overrode or escalated, and the execution resumed.",
    step: "review",
  },
  {
    stage: "Audit + evaluate",
    text: "The outcome was audited, and the same path is regression-tested with golden and adversarial cases.",
    step: "evaluation",
  },
];

export default function SummaryStep() {
  return (
    <StepPage
      slug="summary"
      lead="Deterministic controls are separated from agentic reasoning. Matching detects the issue deterministically, the agent investigates ambiguity with bounded tools, and deterministic governance decides whether the result can be automated. The same path is regression-tested with golden and adversarial datasets."
    >
      <ol className="space-y-2">
        {RECAP.map((item) => (
          <li
            key={item.stage}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-950"
          >
            <span className="w-32 font-semibold tracking-wide uppercase">
              {item.stage}
            </span>
            <span className="min-w-0 flex-1">{item.text}</span>
            <Link
              href={stepHref(item.step)}
              className="text-xs underline underline-offset-2"
            >
              Revisit
            </Link>
          </li>
        ))}
      </ol>

      <Panel title="Where this stands">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
          <li>
            Only price variance has an investigation path; four exception types
            stop at routing.
          </li>
          <li>
            The red-team suite found that the current policy trusts the
            agent&apos;s asserted root cause. Deterministic evidence validation
            is being added in n8n, and baseline and hardened evaluation runs
            will be compared here.
          </li>
          <li>
            No model is called in this demo; model results appear only from
            imported n8n evaluation runs.
          </li>
        </ul>
      </Panel>
    </StepPage>
  );
}
