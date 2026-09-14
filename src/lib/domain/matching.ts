import { z } from "zod";
import { minorToMajor, minorUnitDigits } from "./money";
import {
  currencyCodeSchema,
  matchTypeSchema,
  minorAmountSchema,
  type Transaction,
} from "./transaction";

// Port of the n8n "Deterministic Matching engine" Code node
// (n8n/code-nodes/deterministic-matching-engine.js), verified by
// matching.differential.test.ts.
//
// One intentional difference: tolerance checks are exact. n8n compares
// floating-point percentages, so a variance of exactly the tolerance can be
// flagged ($1.02 vs $1.00 at 2% computes as 2.0000000000000018%). Here the
// comparison uses integers, and exactly-at-tolerance is within tolerance.
// variancePct and messages are still computed as n8n computes them, so the
// output JSON is otherwise identical.

export const exceptionTypeSchema = z.enum([
  "PRICE_VARIANCE",
  "QUANTITY_VARIANCE",
  "MISSING_RECEIPT",
  "CURRENCY_MISMATCH",
  "PO_NOT_FOUND",
]);

/** Highest priority first; the first present type is the primary one. */
export const EXCEPTION_PRIORITY = [
  "PO_NOT_FOUND",
  "CURRENCY_MISMATCH",
  "MISSING_RECEIPT",
  "QUANTITY_VARIANCE",
  "PRICE_VARIANCE",
] as const satisfies readonly ExceptionType[];

export const matchingExceptionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PO_NOT_FOUND"),
    severity: z.literal("HIGH"),
    message: z.string(),
  }),
  z.object({
    type: z.literal("CURRENCY_MISMATCH"),
    severity: z.literal("HIGH"),
    invoiceCurrency: currencyCodeSchema,
    poCurrency: currencyCodeSchema,
    message: z.string(),
  }),
  z.object({
    type: z.literal("PRICE_VARIANCE"),
    severity: z.literal("MEDIUM"),
    /** In the invoice currency. */
    invoiceUnitPriceMinor: minorAmountSchema,
    /** In the PO currency. */
    poUnitPriceMinor: minorAmountSchema,
    variancePct: z.number(),
    tolerancePct: z.number(),
    message: z.string(),
  }),
  z.object({
    type: z.literal("QUANTITY_VARIANCE"),
    severity: z.literal("MEDIUM"),
    invoiceQuantity: z.number(),
    poQuantity: z.number(),
    variancePct: z.number(),
    tolerancePct: z.number(),
    message: z.string(),
  }),
  z.object({
    type: z.literal("MISSING_RECEIPT"),
    severity: z.literal("MEDIUM"),
    message: z.string(),
  }),
]);

export const matchingResultSchema = z.object({
  matchType: matchTypeSchema,
  exceptionDetected: z.boolean(),
  exceptionCount: z.int().nonnegative(),
  primaryExceptionType: exceptionTypeSchema.nullable(),
  exceptions: z.array(matchingExceptionSchema),
  matchStatus: z.enum(["MATCHED", "EXCEPTION"]),
});

export type ExceptionType = z.infer<typeof exceptionTypeSchema>;
export type MatchingException = z.infer<typeof matchingExceptionSchema>;
export type MatchingResult = z.infer<typeof matchingResultSchema>;

export function runMatching(transaction: Transaction): MatchingResult {
  const { invoice, purchaseOrder: po, goodsReceipt: receipt } = transaction;
  const policy = transaction.matchingPolicy;
  const exceptions: MatchingException[] = [];

  if (!po) {
    exceptions.push({
      type: "PO_NOT_FOUND",
      severity: "HIGH",
      message: `Purchase order referenced by invoice ${invoice.invoiceId} could not be found.`,
    });
  } else {
    if (invoice.currency !== po.currency) {
      exceptions.push({
        type: "CURRENCY_MISMATCH",
        severity: "HIGH",
        invoiceCurrency: invoice.currency,
        poCurrency: po.currency,
        message: `Invoice currency ${invoice.currency} does not match PO currency ${po.currency}.`,
      });
    }

    if (po.unitPriceMinor !== 0) {
      // Bring both prices to the same number of decimal places.
      const digits = Math.max(
        minorUnitDigits(invoice.currency),
        minorUnitDigits(po.currency),
      );
      const invoiceScaled =
        invoice.unitPriceMinor *
        10 ** (digits - minorUnitDigits(invoice.currency));
      const poScaled =
        po.unitPriceMinor * 10 ** (digits - minorUnitDigits(po.currency));
      const tolerance = policy.priceTolerancePct;

      if (exceedsTolerance(invoiceScaled, poScaled, tolerance)) {
        const invoicePrice = minorToMajor(
          invoice.unitPriceMinor,
          invoice.currency,
        );
        const poPrice = minorToMajor(po.unitPriceMinor, po.currency);
        const priceVariancePct = ((invoicePrice - poPrice) / poPrice) * 100;
        exceptions.push({
          type: "PRICE_VARIANCE",
          severity: "MEDIUM",
          invoiceUnitPriceMinor: invoice.unitPriceMinor,
          poUnitPriceMinor: po.unitPriceMinor,
          variancePct: Number(priceVariancePct.toFixed(2)),
          tolerancePct: tolerance,
          message: `Price variance ${priceVariancePct.toFixed(2)}% exceeds tolerance of ${tolerance}%.`,
        });
      }
    }

    if (po.quantity !== 0) {
      const scale =
        10 **
        Math.max(decimalPlaces(invoice.quantity), decimalPlaces(po.quantity));
      const quantityTolerance = policy.quantityTolerancePct;

      if (
        exceedsTolerance(
          Math.round(invoice.quantity * scale),
          Math.round(po.quantity * scale),
          quantityTolerance,
        )
      ) {
        const qtyVariancePct =
          ((invoice.quantity - po.quantity) / po.quantity) * 100;
        exceptions.push({
          type: "QUANTITY_VARIANCE",
          severity: "MEDIUM",
          invoiceQuantity: invoice.quantity,
          poQuantity: po.quantity,
          variancePct: Number(qtyVariancePct.toFixed(2)),
          tolerancePct: quantityTolerance,
          message: `Quantity variance ${qtyVariancePct.toFixed(2)}% exceeds tolerance of ${quantityTolerance}%.`,
        });
      }
    }

    if (policy.matchType === "THREE_WAY" && !receipt) {
      exceptions.push({
        type: "MISSING_RECEIPT",
        severity: "MEDIUM",
        message:
          "Goods receipt is required for three-way matching but was not found.",
      });
    }
  }

  const primaryExceptionType =
    EXCEPTION_PRIORITY.find((type) =>
      exceptions.some((e) => e.type === type),
    ) ?? null;
  const exceptionDetected = exceptions.length > 0;

  return {
    matchType: policy.matchType,
    exceptionDetected,
    exceptionCount: exceptions.length,
    primaryExceptionType,
    exceptions,
    matchStatus: exceptionDetected ? "EXCEPTION" : "MATCHED",
  };
}

/**
 * |actual - expected| / |expected| > tolerancePct / 100, evaluated in exact
 * integer arithmetic. `actual` and `expected` are integers on the same scale.
 */
export function exceedsTolerance(
  actual: number,
  expected: number,
  tolerancePct: number,
): boolean {
  const basisPoints = BigInt(Math.round(tolerancePct * 100));
  const difference = BigInt(Math.abs(actual - expected));
  return difference * BigInt(10_000) > basisPoints * BigInt(Math.abs(expected));
}

/** Decimal places in a number's shortest representation (1.25 -> 2, 1e-7 -> 7). */
export function decimalPlaces(value: number): number {
  if (Number.isInteger(value)) return 0;
  const [mantissa, exponent = "0"] = value.toString().split("e");
  const fraction = mantissa.split(".")[1]?.length ?? 0;
  return Math.max(0, fraction - Number(exponent));
}
