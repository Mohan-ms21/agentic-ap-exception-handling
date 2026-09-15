import "server-only";
import { notFound } from "next/navigation";
import { getDataSource } from "@/lib/data-source";
import { isExceptionCase } from "@/lib/domain/execution";
import { WALKTHROUGH_INVOICE_ID } from "@/lib/walkthrough";

// Data access for pages. Everything goes through the data-source contract.

export async function loadBatch() {
  return getDataSource().listInvoiceExecutions();
}

export async function loadInvoiceExecution(invoiceId: string) {
  const execution = await getDataSource().getInvoiceExecution(invoiceId);
  if (!execution) notFound();
  return execution;
}

/** The price-variance case the walkthrough follows (INV-3002). */
export async function loadWalkthroughCase() {
  const execution = await loadInvoiceExecution(WALKTHROUGH_INVOICE_ID);
  if (!isExceptionCase(execution)) {
    throw new Error(
      `${WALKTHROUGH_INVOICE_ID} is expected to open an exception case.`,
    );
  }
  return execution;
}

export async function loadEvaluationRuns() {
  return getDataSource().getEvaluationRuns();
}
