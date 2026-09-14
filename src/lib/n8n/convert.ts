import { z } from "zod";
import { majorToMinor, minorToMajor } from "@/lib/domain/money";
import {
  processingContextSchema,
  transactionSchema,
  type ProcessingContext,
  type Transaction,
} from "@/lib/domain/transaction";
import {
  wireProcessingContextSchema,
  wireTransactionSchema,
  type WireProcessingContext,
  type WireTransaction,
} from "./wire";

/** Data from n8n that cannot be represented in the domain model. */
export class N8nBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "N8nBoundaryError";
  }
}

function parseOrThrow<T>(
  schema: z.ZodType<T>,
  value: unknown,
  what: string,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new N8nBoundaryError(
      `Invalid ${what}:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

function toMinor(value: number, currency: string, field: string): number {
  try {
    return majorToMinor(value, currency);
  } catch (error) {
    throw new N8nBoundaryError(`${field}: ${(error as Error).message}`);
  }
}

export function transactionFromWire(input: unknown): Transaction {
  const wire = parseOrThrow(wireTransactionSchema, input, "n8n transaction");
  const { invoice, purchaseOrder: po, goodsReceipt, matchingPolicy } = wire;

  return parseOrThrow(
    transactionSchema,
    {
      invoice: {
        invoiceId: invoice.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        supplierId: invoice.supplierId,
        supplierName: invoice.supplierName,
        poNumber: invoice.poNumber,
        currency: invoice.currency,
        quantity: invoice.quantity,
        unitPriceMinor: toMinor(
          invoice.unitPrice,
          invoice.currency,
          "invoice.unitPrice",
        ),
      },
      purchaseOrder: po && {
        poNumber: po.poNumber,
        buyer: po.buyer,
        currency: po.currency,
        quantity: po.quantity,
        unitPriceMinor: toMinor(
          po.unitPrice,
          po.currency,
          "purchaseOrder.unitPrice",
        ),
      },
      goodsReceipt,
      matchingPolicy,
    },
    "transaction",
  );
}

export function transactionToWire(transaction: Transaction): WireTransaction {
  const {
    invoice,
    purchaseOrder: po,
    goodsReceipt,
    matchingPolicy,
  } = transaction;
  return {
    invoice: {
      invoiceId: invoice.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      supplierId: invoice.supplierId,
      supplierName: invoice.supplierName,
      poNumber: invoice.poNumber,
      currency: invoice.currency,
      quantity: invoice.quantity,
      unitPrice: minorToMajor(invoice.unitPriceMinor, invoice.currency),
    },
    purchaseOrder: po && {
      poNumber: po.poNumber,
      buyer: po.buyer,
      currency: po.currency,
      quantity: po.quantity,
      unitPrice: minorToMajor(po.unitPriceMinor, po.currency),
    },
    goodsReceipt: goodsReceipt && { ...goodsReceipt },
    matchingPolicy: { ...matchingPolicy },
  };
}

export function processingContextFromWire(input: unknown): ProcessingContext {
  const wire = parseOrThrow(
    wireProcessingContextSchema,
    input,
    "n8n processing context",
  );
  if (!wire.receivedAt) {
    throw new N8nBoundaryError("processingContext.receivedAt is required");
  }
  return parseOrThrow(processingContextSchema, wire, "processing context");
}

export function processingContextToWire(
  context: ProcessingContext,
): WireProcessingContext {
  return { ...context };
}
