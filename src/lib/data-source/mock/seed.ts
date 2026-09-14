import { z } from "zod";
import {
  agentProposalSchema,
  goodsReceiptSchema,
  invoiceSchema,
  purchaseOrderSchema,
  reviewDecisionSchema,
  tolerancePolicySchema,
  vendorSchema,
} from "@/lib/domain/schemas";

/** Source documents plus the agent/reviewer history for each exception. */
export const mockSeedSchema = z.object({
  policy: tolerancePolicySchema,
  vendors: z.array(vendorSchema),
  purchaseOrders: z.array(purchaseOrderSchema),
  goodsReceipts: z.array(goodsReceiptSchema),
  invoices: z.array(invoiceSchema),
  cases: z.array(
    z.object({
      exceptionId: z.string().min(1),
      invoiceId: z.string().min(1),
      detectedAt: z.iso.datetime(),
      proposal: agentProposalSchema.nullable(),
      decision: reviewDecisionSchema.nullable(),
    }),
  ),
});

export type MockSeed = z.infer<typeof mockSeedSchema>;
