import Link from "next/link";
import { StepPage } from "@/components/step-page";
import { Badge } from "@/components/ui/badge";
import { CodeValue } from "@/components/ui/code-value";
import { Panel } from "@/components/ui/panel";
import { EXCEPTION_PRIORITY } from "@/lib/domain/matching";
import { EXCEPTION_TYPE_LABELS } from "@/lib/presentation";
import { loadBatch } from "@/lib/server/demo";
import { REPOSITORY_URL } from "@/lib/walkthrough";

export default async function MatchingStep() {
  const executions = await loadBatch();

  return (
    <StepPage
      slug="matching"
      lead="Matching is code, not AI. The engine compares invoice, purchase order and goods receipt against the tolerances on the transaction, records every exception it finds and picks one primary exception to route."
    >
      <Panel
        title="Matching results"
        description="The six sample invoices: one matched, and one of each exception type"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs text-neutral-500 dark:text-neutral-400">
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Invoice
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  PO
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Result
                </th>
                <th scope="col" className="py-2 font-medium">
                  Next
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {executions.map((execution) => (
                <tr key={execution.invoiceId}>
                  <td className="py-2.5 pr-4">
                    <Link
                      href={`/invoices/${execution.invoiceId}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {execution.invoiceId}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-4">
                    <CodeValue>{execution.poNumber}</CodeValue>
                  </td>
                  <td className="py-2.5 pr-4">
                    {execution.primaryExceptionType ? (
                      <Badge tone="danger">
                        {EXCEPTION_TYPE_LABELS[execution.primaryExceptionType]}
                      </Badge>
                    ) : (
                      <Badge tone="success">Matched</Badge>
                    )}
                  </td>
                  <td className="py-2.5 text-neutral-700 dark:text-neutral-300">
                    {execution.matchStatus === "MATCHED" ? (
                      "Continue to posting"
                    ) : execution.investigationPath ===
                      "PRICE_VARIANCE_AGENT" ? (
                      "Agent investigation"
                    ) : (
                      <span className="inline-flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">No investigation path yet</Badge>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel
          title="Primary exception priority"
          description="When several exceptions occur, the first in this order is routed"
        >
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {EXCEPTION_PRIORITY.map((type) => (
              <li key={type}>
                {EXCEPTION_TYPE_LABELS[type]} <CodeValue>{type}</CodeValue>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="Four types stop at routing">
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            The workflow routes all five exception types, but only price
            variance has an AI investigation path so far. Quantity variance,
            missing receipt, currency mismatch and PO not found are detected and
            labelled here; resolution flows for them are planned.
          </p>
          <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
            Tolerances are compared in exact integer arithmetic.{" "}
            <a
              href={`${REPOSITORY_URL}/blob/main/docs/n8n-float-tolerance-bug.md`}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Porting the engine found a floating-point boundary bug
            </a>{" "}
            in the n8n version.
          </p>
        </Panel>
      </div>
    </StepPage>
  );
}
