import { z } from "zod";
import {
  matchingResultSchema,
  type MatchingException,
  type MatchingResult,
} from "@/lib/domain/matching";
import { majorToMinor, minorToMajor } from "@/lib/domain/money";
import {
  processingContextSchema,
  transactionSchema,
  type ProcessingContext,
  type Transaction,
} from "@/lib/domain/transaction";
import {
  wireMatchingResultSchema,
  wireProcessingContextSchema,
  wireTransactionSchema,
  type WireMatchingException,
  type WireMatchingResult,
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

/**
 * Matching results carry prices; converting them needs the invoice and PO
 * currencies from the transaction they were computed for.
 */
export function matchingResultFromWire(
  input: unknown,
  transaction: Transaction,
): MatchingResult {
  const wire = parseOrThrow(
    wireMatchingResultSchema,
    input,
    "n8n matching result",
  );
  const exceptions = wire.exceptions.map((exception) => {
    if (exception.type !== "PRICE_VARIANCE") return exception;
    const { invoiceUnitPrice, poUnitPrice, ...rest } = exception;
    const poCurrency = transaction.purchaseOrder?.currency;
    if (!poCurrency) {
      throw new N8nBoundaryError(
        "PRICE_VARIANCE reported for a transaction without a PO",
      );
    }
    return {
      ...rest,
      invoiceUnitPriceMinor: toMinor(
        invoiceUnitPrice,
        transaction.invoice.currency,
        "PRICE_VARIANCE.invoiceUnitPrice",
      ),
      poUnitPriceMinor: toMinor(
        poUnitPrice,
        poCurrency,
        "PRICE_VARIANCE.poUnitPrice",
      ),
    };
  });
  return parseOrThrow(
    matchingResultSchema,
    { ...wire, exceptions },
    "matching result",
  );
}

export function matchingResultToWire(
  result: MatchingResult,
  transaction: Transaction,
): WireMatchingResult {
  return {
    ...result,
    exceptions: result.exceptions.map((exception) =>
      matchingExceptionToWire(exception, transaction),
    ),
  };
}

function matchingExceptionToWire(
  exception: MatchingException,
  transaction: Transaction,
): WireMatchingException {
  if (exception.type !== "PRICE_VARIANCE") return { ...exception };
  const { invoiceUnitPriceMinor, poUnitPriceMinor, ...rest } = exception;
  const poCurrency =
    transaction.purchaseOrder?.currency ?? transaction.invoice.currency;
  // Key order matches the n8n node's output.
  return {
    type: rest.type,
    severity: rest.severity,
    invoiceUnitPrice: minorToMajor(
      invoiceUnitPriceMinor,
      transaction.invoice.currency,
    ),
    poUnitPrice: minorToMajor(poUnitPriceMinor, poCurrency),
    variancePct: rest.variancePct,
    tolerancePct: rest.tolerancePct,
    message: rest.message,
  };
}
