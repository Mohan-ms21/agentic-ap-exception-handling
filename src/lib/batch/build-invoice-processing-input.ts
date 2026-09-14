import type { ProcessingContext, Transaction } from "@/lib/domain/transaction";
import { transactionFromWire } from "@/lib/n8n/convert";

// Port of the n8n "Build Invoice Processing Input" Code node in the AP Batch
// Intake workflow (n8n/code-nodes/build-invoice-processing-input.js): turns
// one batch intake row into the canonical transaction envelope (section 9).
// Verified by build-invoice-processing-input.differential.test.ts.

/** A data-table row: CSV exports give strings; n8n data tables may give null. */
export type BatchIntakeRow = Readonly<Record<string, string | number | null>>;

export type InvoiceProcessingInput = {
  batchId: string;
  transaction: Transaction;
  processingContext: ProcessingContext;
};

const isPresent = (value: string | number | null | undefined) =>
  value !== "" && value !== null;

export function buildInvoiceProcessingInput(
  row: BatchIntakeRow,
  now: Date = new Date(),
): InvoiceProcessingInput {
  const hasPO =
    Boolean(row.poNumber) &&
    isPresent(row.poQuantity) &&
    isPresent(row.poUnitPrice);

  const hasReceipt =
    String(row.receiptStatus).toUpperCase() === "RECEIVED" &&
    isPresent(row.quantityReceived);

  return {
    batchId: String(row.batchId),
    transaction: transactionFromWire({
      invoice: {
        invoiceId: row.invoiceId,
        invoiceNumber: row.invoiceNumber,
        supplierId: row.supplierId,
        supplierName: row.supplierName,
        poNumber: row.poNumber,
        currency: row.invoiceCurrency,
        quantity: Number(row.invoiceQuantity),
        unitPrice: Number(row.invoiceUnitPrice),
      },
      purchaseOrder: hasPO
        ? {
            poNumber: row.poNumber,
            buyer: row.buyer,
            currency: row.poCurrency,
            quantity: Number(row.poQuantity),
            unitPrice: Number(row.poUnitPrice),
          }
        : null,
      goodsReceipt: hasReceipt
        ? {
            receiptNumber: `GR-${row.invoiceId}`,
            quantityReceived: Number(row.quantityReceived),
            status: "RECEIVED",
          }
        : null,
      matchingPolicy: {
        matchType: row.matchType,
        priceTolerancePct: Number(row.priceTolerancePct),
        quantityTolerancePct: Number(row.quantityTolerancePct),
      },
    }),
    processingContext: {
      source: "BATCH_INTAKE",
      mode: "NORMAL",
      receivedAt: now.toISOString(),
    },
  };
}
