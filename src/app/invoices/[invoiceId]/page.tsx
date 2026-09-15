import type { Metadata } from "next";
import Link from "next/link";
import { MatchingExceptions } from "@/components/matching-exceptions";
import { TransactionFacts } from "@/components/transaction-facts";
import { Badge } from "@/components/ui/badge";
import { CodeValue } from "@/components/ui/code-value";
import { Panel } from "@/components/ui/panel";
import { isExceptionCase } from "@/lib/domain/execution";
import { EXCEPTION_TYPE_LABELS, executionState } from "@/lib/presentation";
import { loadInvoiceExecution } from "@/lib/server/demo";
import { stepHref, WALKTHROUGH_INVOICE_ID } from "@/lib/walkthrough";

export async function generateMetadata({
  params,
}: PageProps<"/invoices/[invoiceId]">): Promise<Metadata> {
  const { invoiceId } = await params;
  return { title: invoiceId };
}

export default async function InvoicePage({
  params,
}: PageProps<"/invoices/[invoiceId]">) {
  const { invoiceId } = await params;
  const execution = await loadInvoiceExecution(invoiceId);
  const exceptionCase = isExceptionCase(execution) ? execution : null;
  const state = executionState(execution.workflowStatus);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6 sm:px-6">
      <p className="text-sm">
        <Link
          href={stepHref("matching")}
          className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          ← Matching results
        </Link>
      </p>
      <header className="space-y-2">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Batch <CodeValue>{execution.batchId}</CodeValue>
          {exceptionCase && (
            <>
              {" "}
              · Case <CodeValue>{exceptionCase.caseId}</CodeValue>
            </>
          )}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{invoiceId}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={state.tone}>{state.label}</Badge>
          <span className="text-neutral-600 dark:text-neutral-400">
            {state.detail}
          </span>
        </p>
      </header>

      <Panel title="Documents">
        <TransactionFacts transaction={execution.transaction} />
      </Panel>

      <Panel
        title="Matching result"
        description="Calculated by the deterministic matching engine"
      >
        <MatchingExceptions result={execution.matchingResult} />
      </Panel>

      {exceptionCase?.investigationPath === "NONE" && (
        <Panel title="No investigation path yet" variant="dashed">
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            {EXCEPTION_TYPE_LABELS[exceptionCase.caseContext.exceptionType]} is
            detected and routed, but the workflow has no resolution flow for it
            yet, so the execution stops at routing. No agent runs and no
            automation or review is started.
          </p>
        </Panel>
      )}

      {exceptionCase?.investigationPath === "PRICE_VARIANCE_AGENT" &&
        invoiceId === WALKTHROUGH_INVOICE_ID && (
          <Panel title="Investigation">
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              This case is followed step by step in the walkthrough.{" "}
              <Link
                href={stepHref("price-variance")}
                className="font-medium underline underline-offset-2"
              >
                Open the price-variance case →
              </Link>
            </p>
          </Panel>
        )}
    </main>
  );
}
