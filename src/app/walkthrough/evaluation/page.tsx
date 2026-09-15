import Link from "next/link";
import { FalseAutoResolutionPanel } from "@/components/evaluation/false-auto-resolution";
import {
  AggregateMetrics,
  ReleaseGatesTable,
} from "@/components/evaluation/release-gates";
import { RunComparisonView } from "@/components/evaluation/run-comparison";
import { RunRowsTable } from "@/components/evaluation/run-rows";
import { StepPage } from "@/components/step-page";
import { Badge } from "@/components/ui/badge";
import { CodeValue } from "@/components/ui/code-value";
import { Panel } from "@/components/ui/panel";
import {
  compareRuns,
  type EvaluationRun,
  type NamedModelRun,
} from "@/lib/eval/runs";
import { loadEvaluationRuns } from "@/lib/server/demo";
import { stepHref } from "@/lib/walkthrough";

type Tab = "baseline" | "hardened" | "compare" | "self-test";

function RunResults({ run }: { run: EvaluationRun }) {
  return (
    <div className="space-y-4">
      <Panel title="Release gates">
        <ReleaseGatesTable gates={run.gates} />
      </Panel>
      <Panel
        title="Aggregate metrics"
        description="Section 21.2; each case scores 0 or 1 per metric"
      >
        <AggregateMetrics aggregates={run.aggregates} />
      </Panel>
      <Panel
        title="Expected vs actual"
        description="Row-level outputs, rescored with the ported n8n metrics node"
      >
        <RunRowsTable run={run} />
      </Panel>
    </div>
  );
}

function ModelRunState({ modelRun }: { modelRun: NamedModelRun }) {
  const { slot, state } = modelRun;
  switch (state.status) {
    case "IMPORTED":
      return <RunResults run={state.run} />;
    case "NOT_IMPORTED":
      return (
        <Panel title={`${slot.label}: no run imported yet`} variant="dashed">
          <div className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
            <p>{slot.description}</p>
            <p>
              To show it, export the evaluation data table after the n8n run,
              save it as <CodeValue>eval/runs/{slot.id}.csv</CodeValue> and run{" "}
              <CodeValue>npm run generate:data</CodeValue>. No model results are
              shown until then.
            </p>
          </div>
        </Panel>
      );
    case "INCOMPLETE":
      return (
        <Panel title={`${slot.label}: export is incomplete`}>
          <p className="text-sm">
            These cases have no actual results:{" "}
            {state.missingTestCaseIds.join(", ")}.
          </p>
        </Panel>
      );
    case "MISMATCHED":
      return (
        <Panel title={`${slot.label}: export does not match the dataset`}>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {state.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </Panel>
      );
  }
}

export default async function EvaluationStep({
  searchParams,
}: PageProps<"/walkthrough/evaluation">) {
  const { run } = await searchParams;
  const { modelRuns, selfTest } = await loadEvaluationRuns();
  const [baseline, hardened] = modelRuns;
  const bothImported =
    baseline.state.status === "IMPORTED" &&
    hardened.state.status === "IMPORTED";
  const tab: Tab =
    run === "hardened" || run === "compare" || run === "self-test"
      ? run
      : "baseline";

  const tabs: { id: Tab; label: string; note?: string }[] = [
    {
      id: "baseline",
      label: "Baseline",
      note: baseline.state.status === "IMPORTED" ? undefined : "not imported",
    },
    {
      id: "hardened",
      label: "Hardened",
      note: hardened.state.status === "IMPORTED" ? undefined : "not imported",
    },
    {
      id: "compare",
      label: "Before / after",
      note: bothImported ? undefined : "needs both runs",
    },
    { id: "self-test", label: "Scoring self-test" },
  ];

  return (
    <StepPage
      slug="evaluation"
      lead="The evaluation harness runs the same decision path as production: matching, the agent, the tool, normalization and governance. It stops before any real side effect and scores each case against an answer key."
    >
      <FalseAutoResolutionPanel modelRuns={modelRuns} />

      <nav aria-label="Evaluation runs" className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`${stepHref("evaluation")}?run=${item.id}`}
            aria-current={tab === item.id ? "page" : undefined}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              tab === item.id
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                : "border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            }`}
          >
            {item.label}
            {item.note && (
              <span className="ml-1.5 text-xs opacity-70">({item.note})</span>
            )}
          </Link>
        ))}
      </nav>

      {tab === "baseline" && <ModelRunState modelRun={baseline} />}
      {tab === "hardened" && <ModelRunState modelRun={hardened} />}
      {tab === "compare" &&
        (baseline.state.status === "IMPORTED" &&
        hardened.state.status === "IMPORTED" ? (
          <Panel
            title="Baseline vs hardened policy"
            description="Same dataset, current policy vs evidence validation"
          >
            <RunComparisonView
              comparison={compareRuns(baseline.state.run, hardened.state.run)}
              beforeLabel="Baseline"
              afterLabel="Hardened"
            />
          </Panel>
        ) : (
          <Panel title="Before / after comparison" variant="dashed">
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              Available once both the baseline run (current policy) and the
              hardened run (deterministic evidence validation) are imported. It
              will show each release gate side by side and every case whose
              governance outcome changed.
            </p>
          </Panel>
        ))}
      {tab === "self-test" && (
        <div className="space-y-4">
          <div className="rounded-lg border-2 border-dashed border-violet-400 bg-violet-50 p-4 text-sm dark:border-violet-700 dark:bg-violet-950/40">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              <Badge tone="accent">Self-test</Badge> {selfTest.label}: not a
              model result
            </p>
            <p className="mt-1 text-neutral-700 dark:text-neutral-300">
              {selfTest.description}
            </p>
          </div>
          <RunResults run={selfTest} />
        </div>
      )}
    </StepPage>
  );
}
