// All data in this directory is synthetic. Vendors, documents and people are
// fictional, and no real company, vendor or financial data is used.

import type { TolerancePolicy } from "@/lib/domain/schemas";
import { usd } from "./builders";
import { scenarios } from "./scenarios";
import { quillfeather, tallowmere, veloren } from "./vendors";
import type { MockSeed } from "../seed";

export const tolerancePolicy: TolerancePolicy = {
  lineMaxVarianceBps: 200, // 2%
  lineMaxVariance: usd("50.00"),
  invoiceMaxVariance: usd("250.00"),
};

export const mockSeed: MockSeed = {
  policy: tolerancePolicy,
  vendors: [quillfeather, tallowmere, veloren],
  purchaseOrders: scenarios.map((s) => s.documents.purchaseOrder),
  goodsReceipts: scenarios.map((s) => s.documents.goodsReceipt),
  invoices: scenarios.map((s) => s.documents.invoice),
  cases: scenarios.map((s) => s.mockCase),
};
