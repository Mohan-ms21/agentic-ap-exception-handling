import { describe, expect, it } from "vitest";
import {
  invoiceExecutionSchema,
  isExceptionCase,
  startInvoiceExecution,
} from "./execution";
import type { Transaction } from "./transaction";

const transaction: Transaction = {
  invoice: {
    invoiceId: "INV-3001",
    invoiceNumber: "DEMO-3001",
    supplierId: "SUP-001",
    supplierName: "Demo Supplier A",
    poNumber: "PO-3001",
    currency: "USD",
    quantity: 10,
    unitPriceMinor: 10000,
  },
  purchaseOrder: {
    poNumber: "PO-3001",
    buyer: "Demo Buyer 1",
    currency: "USD",
    quantity: 10,
    unitPriceMinor: 10000,
  },
  goodsReceipt: {
    receiptNumber: "GR-INV-3001",
    quantityReceived: 10,
    status: "RECEIVED",
  },
  matchingPolicy: {
    matchType: "THREE_WAY",
    priceTolerancePct: 2,
    quantityTolerancePct: 0,
  },
};

const input = {
  batchId: "BATCH-DEMO-001",
  transaction,
  processingContext: {
    source: "BATCH_INTAKE" as const,
    mode: "NORMAL" as const,
    receivedAt: "2026-09-09T15:34:00.398Z",
  },
};

describe("startInvoiceExecution", () => {
  it("continues a matched invoice to posting without opening a case", () => {
    const execution = startInvoiceExecution(input);
    expect(isExceptionCase(execution)).toBe(false);
    expect(execution).toMatchObject({
      workflowStatus: "MATCHED",
      nextAction: "CONTINUE_TO_POSTING",
      matchingResult: { matchStatus: "MATCHED", exceptionDetected: false },
    });
    expect(invoiceExecutionSchema.safeParse(execution).success).toBe(true);
  });

  it("opens a case for an exception", () => {
    const execution = startInvoiceExecution({
      ...input,
      transaction: {
        ...transaction,
        invoice: { ...transaction.invoice, unitPriceMinor: 11000 },
      },
    });
    expect(isExceptionCase(execution)).toBe(true);
    expect(execution.workflowStatus).toBe("UNDER_AGENT_INVESTIGATION");
  });
});
