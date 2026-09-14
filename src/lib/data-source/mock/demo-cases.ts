import type { OpenCaseInput } from "@/lib/domain/case";
import type { Transaction } from "@/lib/domain/transaction";

// Synthetic cases that are not in the eval dataset:
// - one per exception type that has no investigation path in the workflow
//   yet (quantity variance, missing receipt, currency mismatch, PO not
//   found), so the queue shows how they are routed today;
// - one price variance still under agent investigation.

const baseTransaction = (n: number): Transaction => ({
  invoice: {
    invoiceId: `INV-DEMO-${n}`,
    invoiceNumber: `DEMO-INV-${n}`,
    supplierId: "SUP-DEMO",
    supplierName: "Demo Supplier",
    poNumber: `PO-DEMO-${n}`,
    currency: "USD",
    quantity: 10,
    unitPriceMinor: 25000,
  },
  purchaseOrder: {
    poNumber: `PO-DEMO-${n}`,
    buyer: "Demo Buyer",
    currency: "USD",
    quantity: 10,
    unitPriceMinor: 25000,
  },
  goodsReceipt: {
    receiptNumber: `GR-INV-DEMO-${n}`,
    quantityReceived: 10,
    status: "RECEIVED",
  },
  matchingPolicy: {
    matchType: "THREE_WAY",
    priceTolerancePct: 2,
    quantityTolerancePct: 0,
  },
});

const batch = (
  transaction: Transaction,
): Omit<OpenCaseInput, "processingContext"> => ({
  batchId: "BATCH-DEMO-001",
  transaction,
});

export const detectionOnlyCases = [
  (() => {
    const t = baseTransaction(101);
    return batch({ ...t, invoice: { ...t.invoice, quantity: 12 } });
  })(),
  (() => {
    const t = baseTransaction(102);
    return batch({ ...t, goodsReceipt: null });
  })(),
  (() => {
    const t = baseTransaction(103);
    return batch({ ...t, invoice: { ...t.invoice, currency: "EUR" } });
  })(),
  (() => {
    const t = baseTransaction(104);
    return batch({ ...t, purchaseOrder: null, goodsReceipt: null });
  })(),
];

export const underInvestigationCase = (() => {
  const t = baseTransaction(201);
  return batch({
    ...t,
    invoice: { ...t.invoice, unitPriceMinor: 11000 },
    purchaseOrder: { ...t.purchaseOrder!, unitPriceMinor: 10000 },
  });
})();
