import Link from "next/link";
import { stepHref, WALKTHROUGH_STEPS } from "@/lib/walkthrough";

const STAGES = [
  { name: "Detect", detail: "Deterministic matching engine" },
  { name: "Investigate", detail: "Bounded AI agent + authoritative tools" },
  { name: "Govern", detail: "Deterministic policy and risk gate" },
  { name: "Act", detail: "Controlled automation or human review" },
  {
    name: "Audit + evaluate",
    detail: "Evidence, decisions, regression and red-team tests",
  },
];

export default function OverviewPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-4 py-10 sm:px-6">
      <section className="space-y-4">
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
          Accounts payable · exception resolution
        </p>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Detect deterministically, investigate agentically, govern
          deterministically.
        </h1>
        <p className="max-w-3xl text-lg text-neutral-700 dark:text-neutral-300">
          The AI agent is a bounded reasoning component inside a controlled
          workflow. It is not the matching engine, the policy engine, the state
          machine, the security boundary or the system of record.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href={stepHref(WALKTHROUGH_STEPS[0].slug)}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            Start the walkthrough →
          </Link>
        </div>
      </section>

      <section aria-label="Pipeline stages">
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          {STAGES.map((stage, index) => (
            <li
              key={stage.name}
              className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950"
            >
              <p className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                {index + 1}
              </p>
              <p className="mt-1 text-sm font-semibold tracking-wide uppercase">
                {stage.name}
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {stage.detail}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="text-sm font-semibold">What is real here</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            The matching engine, governance policy, human-review routing, audit
            record and evaluation scoring are ports of the n8n workflow&apos;s
            code, tested against the original nodes.
          </p>
        </div>
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-950">
          <h2 className="text-sm font-semibold">What is not</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            No model is called. Agent output shown in the demo is written from
            the documentation, and all invoice, supplier and buyer data is
            synthetic. Model results appear only from imported n8n evaluation
            runs.
          </p>
        </div>
      </section>
    </main>
  );
}
