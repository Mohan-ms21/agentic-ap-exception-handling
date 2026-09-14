import { z } from "zod";

// Domain model for AP invoice exception handling. Schemas are the single
// source of truth: TypeScript types are inferred from them, and the same
// schemas validate data crossing a backend boundary (e.g. n8n responses).

const id = z.string().min(1);
const isoDate = z.iso.date(); // YYYY-MM-DD
const isoDateTime = z.iso.datetime(); // UTC, e.g. 2026-08-14T09:30:00Z

// --- Money -----------------------------------------------------------------

export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Expected an ISO 4217 currency code");

/**
 * An amount in the currency's minor unit (cents for USD) as an integer, to
 * avoid floating-point error. Known limitation: sub-minor-unit prices (e.g.
 * $0.0125 per unit) cannot be represented.
 */
export const moneySchema = z.object({
  amountMinor: z.int(),
  currency: currencyCodeSchema,
});

// --- Master data and source documents ----------------------------------------

export const personSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
});

export const vendorSchema = z.object({
  id,
  vendorNumber: z.string().min(1),
  name: z.string().min(1),
  paymentTerms: z.string().min(1), // e.g. "NET30"
  defaultCurrency: currencyCodeSchema,
});

export const purchaseOrderLineSchema = z.object({
  lineNumber: z.int().positive(),
  itemCode: z.string().min(1),
  description: z.string().min(1),
  quantityOrdered: z.number().positive(),
  unitOfMeasure: z.string().min(1),
  unitPrice: moneySchema,
});

export const purchaseOrderStatusSchema = z.enum([
  "open",
  "partially_received",
  "closed",
]);

export const purchaseOrderSchema = z.object({
  id,
  poNumber: z.string().min(1),
  vendorId: id,
  currency: currencyCodeSchema,
  status: purchaseOrderStatusSchema,
  orderDate: isoDate,
  buyer: personSchema,
  lines: z.array(purchaseOrderLineSchema).min(1),
});

export const goodsReceiptSchema = z.object({
  id,
  receiptNumber: z.string().min(1),
  purchaseOrderId: id,
  receivedDate: isoDate,
  lines: z
    .array(
      z.object({
        poLineNumber: z.int().positive(),
        quantityReceived: z.number().positive(),
      }),
    )
    .min(1),
});

export const invoiceLineSchema = z.object({
  lineNumber: z.int().positive(),
  /** The PO line this invoice line bills against; null if unmatched. */
  poLineNumber: z.int().positive().nullable(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitOfMeasure: z.string().min(1),
  unitPrice: moneySchema,
  lineAmount: moneySchema,
});

export const invoiceSchema = z.object({
  id,
  /** The vendor's own invoice number. */
  invoiceNumber: z.string().min(1),
  vendorId: id,
  poNumber: z.string().min(1),
  currency: currencyCodeSchema,
  invoiceDate: isoDate,
  receivedDate: isoDate,
  dueDate: isoDate,
  lines: z.array(invoiceLineSchema).min(1),
  subtotal: moneySchema,
  tax: moneySchema,
  total: moneySchema,
});

// --- Tolerance policy ---------------------------------------------------------

/**
 * A line is out of tolerance if its unit-price variance exceeds
 * `lineMaxVarianceBps` OR its extended variance exceeds `lineMaxVariance`.
 * An invoice is out of tolerance if the sum of absolute extended variances
 * exceeds `invoiceMaxVariance`. Limits are exclusive: exactly at the limit is
 * within tolerance. Applies to favorable and unfavorable variances alike.
 */
export const tolerancePolicySchema = z.object({
  /** Basis points: 200 = 2%. Integer so the comparison is exact. */
  lineMaxVarianceBps: z.int().nonnegative(),
  lineMaxVariance: moneySchema,
  invoiceMaxVariance: moneySchema,
});

// --- Exceptions ---------------------------------------------------------------

/**
 * Every exception type in scope for the product. Only `price_variance` is
 * implemented; the others are named so the model shows the full scope, and
 * get detail schemas when they are built.
 */
export const exceptionTypeSchema = z.enum([
  "price_variance",
  "quantity_variance",
  "missing_or_closed_po",
  "duplicate_suspicion",
  "vendor_master_mismatch",
  "tax_discrepancy",
]);

export const exceptionStatusSchema = z.enum([
  "pending_proposal", // detected; the agent has not proposed a resolution yet
  "awaiting_review", // proposal ready for a human decision
  "resolved", // a reviewer approved or edited the proposal
  "escalated", // a reviewer rejected the proposal; handled manually
]);

export const varianceDirectionSchema = z.enum([
  "unfavorable", // invoiced above PO price
  "favorable", // invoiced below PO price
  "none",
]);

export const priceVarianceLineSchema = z.object({
  invoiceLineNumber: z.int().positive(),
  poLineNumber: z.int().positive(),
  quantity: z.number().positive(),
  poUnitPrice: moneySchema,
  invoiceUnitPrice: moneySchema,
  /** invoiceUnitPrice - poUnitPrice */
  unitVariance: moneySchema,
  /** Rounded to 2 decimals for display; null when the PO price is zero. */
  variancePercent: z.number().nullable(),
  /** unitVariance x quantity */
  extendedVariance: moneySchema,
  direction: varianceDirectionSchema,
  exceedsPercentLimit: z.boolean(),
  exceedsAmountLimit: z.boolean(),
});

export const priceVarianceDetailsSchema = z.object({
  policy: tolerancePolicySchema,
  lines: z.array(priceVarianceLineSchema),
  totalAbsoluteVariance: moneySchema,
  exceedsInvoiceLimit: z.boolean(),
});

const exceptionBase = {
  id,
  invoiceId: id,
  purchaseOrderId: id,
  vendorId: id,
  status: exceptionStatusSchema,
  detectedAt: isoDateTime,
};

/** Discriminated on `type`; new exception types add a member here. */
export const invoiceExceptionSchema = z.discriminatedUnion("type", [
  z.object({
    ...exceptionBase,
    type: z.literal("price_variance"),
    details: priceVarianceDetailsSchema,
  }),
]);

// --- Agent proposals ----------------------------------------------------------

export const resolutionActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("approve_at_invoice_price") }),
  z.object({
    type: z.literal("request_credit_note"),
    amount: moneySchema,
  }),
  z.object({
    type: z.literal("route_to_buyer"),
    reason: z.string().min(1),
  }),
  z.object({
    type: z.literal("hold_for_investigation"),
    reason: z.string().min(1),
  }),
]);

export const evidenceSchema = z.object({
  kind: z.enum([
    "po_line",
    "invoice_line",
    "goods_receipt",
    "vendor_price_list",
    "contract",
    "quote",
  ]),
  /** Human-readable pointer, e.g. "PO-4500101 line 1". */
  reference: z.string().min(1),
  summary: z.string().min(1),
});

/** Deliberately coarse: a numeric score would imply false precision. */
export const confidenceSchema = z.enum(["low", "medium", "high"]);

export const agentBackendSchema = z.enum(["mock", "n8n", "langgraph"]);

export const agentProposalSchema = z.object({
  id,
  exceptionId: id,
  action: resolutionActionSchema,
  rationale: z.string().min(1),
  evidence: z.array(evidenceSchema).min(1),
  confidence: confidenceSchema,
  proposedAt: isoDateTime,
  producedBy: z.object({
    backend: agentBackendSchema,
    agentVersion: z.string().min(1),
  }),
});

// --- Human review -------------------------------------------------------------

const decisionBase = {
  reviewer: personSchema,
  decidedAt: isoDateTime,
};

/**
 * Approved: the proposed action is taken as-is.
 * Edited: a different action is taken; a comment explaining why is required.
 * Rejected: no action is taken and the exception is escalated; a comment is
 * required.
 */
export const reviewDecisionSchema = z.discriminatedUnion("outcome", [
  z.object({
    ...decisionBase,
    outcome: z.literal("approved"),
    finalAction: resolutionActionSchema,
    comment: z.string().optional(),
  }),
  z.object({
    ...decisionBase,
    outcome: z.literal("edited"),
    finalAction: resolutionActionSchema,
    comment: z.string().trim().min(1),
  }),
  z.object({
    ...decisionBase,
    outcome: z.literal("rejected"),
    comment: z.string().trim().min(1),
  }),
]);

// --- Audit trail --------------------------------------------------------------

export const auditEventSchema = z.object({
  id,
  at: isoDateTime,
  actor: z.object({
    kind: z.enum(["agent", "user", "system"]),
    name: z.string().min(1),
  }),
  type: z.enum(["exception_detected", "proposal_created", "decision_recorded"]),
  message: z.string().min(1),
});

// --- Inferred types -----------------------------------------------------------

export type CurrencyCode = z.infer<typeof currencyCodeSchema>;
export type Money = z.infer<typeof moneySchema>;
export type Person = z.infer<typeof personSchema>;
export type Vendor = z.infer<typeof vendorSchema>;
export type PurchaseOrderLine = z.infer<typeof purchaseOrderLineSchema>;
export type PurchaseOrderStatus = z.infer<typeof purchaseOrderStatusSchema>;
export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>;
export type GoodsReceipt = z.infer<typeof goodsReceiptSchema>;
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type TolerancePolicy = z.infer<typeof tolerancePolicySchema>;
export type ExceptionType = z.infer<typeof exceptionTypeSchema>;
export type ExceptionStatus = z.infer<typeof exceptionStatusSchema>;
export type VarianceDirection = z.infer<typeof varianceDirectionSchema>;
export type PriceVarianceLine = z.infer<typeof priceVarianceLineSchema>;
export type PriceVarianceDetails = z.infer<typeof priceVarianceDetailsSchema>;
export type InvoiceException = z.infer<typeof invoiceExceptionSchema>;
export type ResolutionAction = z.infer<typeof resolutionActionSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Confidence = z.infer<typeof confidenceSchema>;
export type AgentBackend = z.infer<typeof agentBackendSchema>;
export type AgentProposal = z.infer<typeof agentProposalSchema>;
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
