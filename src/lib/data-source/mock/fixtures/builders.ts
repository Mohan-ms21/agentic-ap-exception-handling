import { multiplyMoney, parseMoney, sumMoney } from "@/lib/domain/money";
import type {
  AgentProposal,
  GoodsReceipt,
  Invoice,
  Person,
  PurchaseOrder,
  Vendor,
} from "@/lib/domain/schemas";

// Helpers that derive amounts, totals and due dates from a compact scenario
// spec, so fixture numbers are computed rather than hand-typed.

export const usd = (value: string) => parseMoney(value, "USD");

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addSeconds(isoDateTime: string, seconds: number): string {
  const date = new Date(new Date(isoDateTime).getTime() + seconds * 1000);
  return date.toISOString().replace(".000Z", "Z");
}

function paymentTermDays(terms: string): number {
  const match = /^NET(\d+)$/.exec(terms);
  if (!match) throw new Error(`Unsupported payment terms: ${terms}`);
  return Number(match[1]);
}

export type LineSpec = {
  itemCode: string;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  poPrice: string;
  invoicePrice: string;
};

export type DocumentSpec = {
  vendor: Vendor;
  buyer: Person;
  po: { number: string; orderDate: string };
  receipt: { number: string; receivedDate: string };
  invoice: {
    id: string;
    number: string;
    invoiceDate: string;
    receivedDate: string;
    taxRateBps: number;
  };
  /** Invoice line N bills PO line N; every line is received in full. */
  lines: LineSpec[];
};

export type Documents = {
  purchaseOrder: PurchaseOrder;
  goodsReceipt: GoodsReceipt;
  invoice: Invoice;
};

export function buildDocuments(spec: DocumentSpec): Documents {
  const currency = spec.vendor.defaultCurrency;
  const price = (value: string) => parseMoney(value, currency);

  const purchaseOrder: PurchaseOrder = {
    id: spec.po.number.toLowerCase(),
    poNumber: spec.po.number,
    vendorId: spec.vendor.id,
    currency,
    status: "open",
    orderDate: spec.po.orderDate,
    buyer: spec.buyer,
    lines: spec.lines.map((line, i) => ({
      lineNumber: i + 1,
      itemCode: line.itemCode,
      description: line.description,
      quantityOrdered: line.quantity,
      unitOfMeasure: line.unitOfMeasure,
      unitPrice: price(line.poPrice),
    })),
  };

  const goodsReceipt: GoodsReceipt = {
    id: spec.receipt.number.toLowerCase(),
    receiptNumber: spec.receipt.number,
    purchaseOrderId: purchaseOrder.id,
    receivedDate: spec.receipt.receivedDate,
    lines: spec.lines.map((line, i) => ({
      poLineNumber: i + 1,
      quantityReceived: line.quantity,
    })),
  };

  const invoiceLines = spec.lines.map((line, i) => {
    const unitPrice = price(line.invoicePrice);
    return {
      lineNumber: i + 1,
      poLineNumber: i + 1,
      description: line.description,
      quantity: line.quantity,
      unitOfMeasure: line.unitOfMeasure,
      unitPrice,
      lineAmount: multiplyMoney(unitPrice, line.quantity),
    };
  });
  const subtotal = sumMoney(
    invoiceLines.map((l) => l.lineAmount),
    currency,
  );
  const tax = multiplyMoney(subtotal, spec.invoice.taxRateBps / 10_000);

  const invoice: Invoice = {
    id: spec.invoice.id,
    invoiceNumber: spec.invoice.number,
    vendorId: spec.vendor.id,
    poNumber: spec.po.number,
    currency,
    invoiceDate: spec.invoice.invoiceDate,
    receivedDate: spec.invoice.receivedDate,
    dueDate: addDays(
      spec.invoice.invoiceDate,
      paymentTermDays(spec.vendor.paymentTerms),
    ),
    lines: invoiceLines,
    subtotal,
    tax,
    total: sumMoney([subtotal, tax], currency),
  };

  return { purchaseOrder, goodsReceipt, invoice };
}

export const MOCK_AGENT: AgentProposal["producedBy"] = {
  backend: "mock",
  agentVersion: "mock-agent 0.1.0",
};
