import { z } from "zod";

// JSON shapes exactly as the n8n workflows produce and consume them. Prices
// are major-unit numbers (unitPrice: 110). Nothing outside src/lib/n8n
// should use these types; convert.ts maps them to the domain model.

export const wireInvoiceSchema = z.object({
  invoiceId: z.string(),
  invoiceNumber: z.string(),
  supplierId: z.string(),
  supplierName: z.string(),
  poNumber: z.string(),
  currency: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
});

export const wirePurchaseOrderSchema = z.object({
  poNumber: z.string(),
  buyer: z.string(),
  currency: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
});

export const wireGoodsReceiptSchema = z.object({
  receiptNumber: z.string(),
  quantityReceived: z.number(),
  status: z.string(),
});

export const wireMatchingPolicySchema = z.object({
  matchType: z.string(),
  priceTolerancePct: z.number(),
  quantityTolerancePct: z.number(),
});

export const wireTransactionSchema = z.object({
  invoice: wireInvoiceSchema,
  purchaseOrder: wirePurchaseOrderSchema.nullable(),
  goodsReceipt: wireGoodsReceiptSchema.nullable(),
  matchingPolicy: wireMatchingPolicySchema,
});

export const wireProcessingContextSchema = z.object({
  source: z.string(),
  mode: z.string(),
  receivedAt: z.string().optional(),
});

export type WireTransaction = z.infer<typeof wireTransactionSchema>;
export type WireProcessingContext = z.infer<typeof wireProcessingContextSchema>;

export const wireMatchingExceptionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PO_NOT_FOUND"),
    severity: z.string(),
    message: z.string(),
  }),
  z.object({
    type: z.literal("CURRENCY_MISMATCH"),
    severity: z.string(),
    invoiceCurrency: z.string(),
    poCurrency: z.string(),
    message: z.string(),
  }),
  z.object({
    type: z.literal("PRICE_VARIANCE"),
    severity: z.string(),
    invoiceUnitPrice: z.number(),
    poUnitPrice: z.number(),
    variancePct: z.number(),
    tolerancePct: z.number(),
    message: z.string(),
  }),
  z.object({
    type: z.literal("QUANTITY_VARIANCE"),
    severity: z.string(),
    invoiceQuantity: z.number(),
    poQuantity: z.number(),
    variancePct: z.number(),
    tolerancePct: z.number(),
    message: z.string(),
  }),
  z.object({
    type: z.literal("MISSING_RECEIPT"),
    severity: z.string(),
    message: z.string(),
  }),
]);

export const wireMatchingResultSchema = z.object({
  matchType: z.string(),
  exceptionDetected: z.boolean(),
  exceptionCount: z.number(),
  primaryExceptionType: z.string().nullable(),
  exceptions: z.array(wireMatchingExceptionSchema),
  matchStatus: z.string(),
});

export type WireMatchingException = z.infer<typeof wireMatchingExceptionSchema>;
export type WireMatchingResult = z.infer<typeof wireMatchingResultSchema>;

export const wirePoAmendmentLookupSchema = z.discriminatedUnion(
  "lookupStatus",
  [
    z.object({
      lookupStatus: z.literal("FOUND"),
      poNumber: z.string(),
      amendment: z.object({
        amendmentId: z.string(),
        poNumber: z.string(),
        status: z.string(),
        previousUnitPrice: z.number(),
        revisedUnitPrice: z.number(),
        currency: z.string(),
        approvedBy: z.string().nullable().optional(),
        approvalDate: z.string().nullable().optional(),
        reason: z.string(),
      }),
    }),
    z.object({
      lookupStatus: z.literal("NOT_FOUND"),
      poNumber: z.string(),
      amendment: z.null(),
    }),
    z.object({
      lookupStatus: z.literal("LOOKUP_FAILED"),
      poNumber: z.string(),
      amendment: z.null(),
      error: z.object({ code: z.string(), message: z.string() }),
    }),
  ],
);

export type WirePoAmendmentLookup = z.infer<typeof wirePoAmendmentLookupSchema>;
