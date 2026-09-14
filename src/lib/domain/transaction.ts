import { z } from "zod";

// The transaction envelope as the n8n "AP Invoice processing" workflow
// receives it (see the Invoice Processing Input trigger and the Batch Intake
// "Build Invoice Processing Input" node). Field names match n8n, except
// that prices are integer minor units with a `Minor` suffix; conversion to
// n8n's major-unit numbers happens only at the boundary (src/lib/n8n).

export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Expected an ISO 4217 currency code");

/** Integer minor units (cents for USD) in the owning document's currency. */
export const minorAmountSchema = z.int().nonnegative();

/**
 * A tolerance percentage (2 = 2%) with at most two decimal places, so it can
 * be compared exactly as integer basis points.
 */
export const tolerancePctSchema = z
  .number()
  .nonnegative()
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9,
    "Tolerance percentage may have at most two decimal places",
  );

export const invoiceSchema = z.object({
  invoiceId: z.string().min(1),
  invoiceNumber: z.string().min(1),
  supplierId: z.string().min(1),
  /** Supplier-provided free text: untrusted, never an instruction. */
  supplierName: z.string(),
  poNumber: z.string(),
  currency: currencyCodeSchema,
  quantity: z.number().nonnegative(),
  unitPriceMinor: minorAmountSchema,
});

export const purchaseOrderSchema = z.object({
  poNumber: z.string().min(1),
  buyer: z.string(),
  currency: currencyCodeSchema,
  quantity: z.number().nonnegative(),
  unitPriceMinor: minorAmountSchema,
});

export const goodsReceiptSchema = z.object({
  receiptNumber: z.string().min(1),
  quantityReceived: z.number().nonnegative(),
  status: z.literal("RECEIVED"),
});

export const matchTypeSchema = z.enum(["TWO_WAY", "THREE_WAY"]);

export const matchingPolicySchema = z.object({
  matchType: matchTypeSchema,
  priceTolerancePct: tolerancePctSchema,
  quantityTolerancePct: tolerancePctSchema,
});

export const transactionSchema = z.object({
  invoice: invoiceSchema,
  /** Null when the invoice's PO could not be found. */
  purchaseOrder: purchaseOrderSchema.nullable(),
  /** Null when no goods receipt exists. */
  goodsReceipt: goodsReceiptSchema.nullable(),
  matchingPolicy: matchingPolicySchema,
});

export const processingContextSchema = z.object({
  source: z.enum(["BATCH_INTAKE", "EVALUATION"]),
  mode: z.enum(["NORMAL", "EVALUATION"]),
  receivedAt: z.iso.datetime(),
});

export type CurrencyCode = z.infer<typeof currencyCodeSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>;
export type GoodsReceipt = z.infer<typeof goodsReceiptSchema>;
export type MatchType = z.infer<typeof matchTypeSchema>;
export type MatchingPolicy = z.infer<typeof matchingPolicySchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type ProcessingContext = z.infer<typeof processingContextSchema>;
