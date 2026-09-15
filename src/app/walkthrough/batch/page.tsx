import Link from "next/link";
import { StepPage } from "@/components/step-page";
import { Badge } from "@/components/ui/badge";
import { CodeValue } from "@/components/ui/code-value";
import { Panel } from "@/components/ui/panel";
import { EXCEPTION_TYPE_LABELS, executionState } from "@/lib/presentation";
import { loadBatch } from "@/lib/server/demo";

export default async function BatchStep() {
  const executions = await loadBatch();
  const batchId = executions[0]?.batchId;
  const waiting = executions.filter(
    (e) => e.workflowStatus === "WAITING_FOR_HUMAN_REVIEW",
  );
  const stopped = executions.filter(
    (e) => e.investigationPath === "NONE",
  ).length;
  const waitingSummary =
    waiting.length > 0
      ? `${waiting.map((e) => e.invoiceId).join(", ")} ${waiting.length === 1 ? "is" : "are"} waiting for an analyst while the others have finished or stopped at routing (${stopped} with no investigation path yet).`
      : `no execution is waiting: the others have finished or stopped at routing (${stopped} with no investigation path yet).`;

  return (
    <StepPage
      slug="batch"
      lead="One batch can hold many invoices, but every invoice runs in its own child workflow execution, so one invoice waiting for review never blocks the rest of the batch."
    >
      <Panel
        title={
          <>
            Batch <CodeValue>{batchId}</CodeValue>
          </>
        }
        description={`${executions.length} invoices, ${executions.length} independent executions`}
      >
        <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {executions.map((execution, index) => {
            const state = executionState(execution.workflowStatus);
            return (
              <li
                key={execution.invoiceId}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm"
              >
                <span className="w-24 font-mono text-xs text-neutral-500 dark:text-neutral-400">
                  execution #{index + 1}
                </span>
                <Link
                  href={`/invoices/${execution.invoiceId}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {execution.invoiceId}
                </Link>
                <span className="text-neutral-500 dark:text-neutral-400">
                  {execution.primaryExceptionType
                    ? EXCEPTION_TYPE_LABELS[execution.primaryExceptionType]
                    : "Matched"}
                </span>
                <span className="ml-auto flex flex-wrap items-center gap-2">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {state.detail}
                  </span>
                  <Badge tone={state.tone}>{state.label}</Badge>
                </span>
              </li>
            );
          })}
        </ol>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Why one execution per invoice">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
            <li>An invoice waiting for review does not block the others.</li>
            <li>
              A failed AI call is retried for one invoice, not the whole batch.
            </li>
            <li>State and audit history are scoped to the invoice.</li>
          </ul>
        </Panel>
        <Panel title="What the states mean">
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            In n8n the same batch shows <Badge tone="success">Succeeded</Badge>{" "}
            and <Badge tone="warning">Waiting</Badge> executions side by side.
            Here, {waitingSummary}
          </p>
        </Panel>
      </div>
    </StepPage>
  );
}
