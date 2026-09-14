import { describe, expect, it } from "vitest";
import { decimalPlaces, exceedsTolerance, runMatching } from "./matching";
import type { Transaction } from "./transaction";

function transaction(
  overrides: {
    invoice?: Partial<Transaction["invoice"]>;
    purchaseOrder?: Partial<NonNullable<Transaction["purchaseOrder"]>> | null;
    goodsReceipt?: Transaction["goodsReceipt"];
    matchingPolicy?: Partial<Transaction["matchingPolicy"]>;
  } = {},
): Transaction {
  return {
    invoice: {
      invoiceId: "INV-1",
      invoiceNumber: "N-1",
      supplierId: "SUP-1",
      supplierName: "Evaluation Supplier",
      poNumber: "PO-1",
      currency: "USD",
      quantity: 10,
      unitPriceMinor: 10000,
      ...overrides.invoice,
    },
    purchaseOrder:
      overrides.purchaseOrder === null
        ? null
        : {
            poNumber: "PO-1",
            buyer: "Evaluation Buyer",
            currency: "USD",
            quantity: 10,
            unitPriceMinor: 10000,
            ...overrides.purchaseOrder,
          },
    goodsReceipt:
      overrides.goodsReceipt === undefined
        ? { receiptNumber: "GR-1", quantityReceived: 10, status: "RECEIVED" }
        : overrides.goodsReceipt,
    matchingPolicy: {
      matchType: "THREE_WAY",
      priceTolerancePct: 2,
      quantityTolerancePct: 0,
      ...overrides.matchingPolicy,
    },
  };
}

describe("runMatching", () => {
  it("reports a clean three-way match", () => {
    expect(runMatching(transaction())).toEqual({
      matchType: "THREE_WAY",
      exceptionDetected: false,
      exceptionCount: 0,
      primaryExceptionType: null,
      exceptions: [],
      matchStatus: "MATCHED",
    });
  });

  it("flags the eval dataset's 110 vs 100 price variance with n8n's message", () => {
    const result = runMatching(
      transaction({ invoice: { unitPriceMinor: 11000 } }),
    );
    expect(result.primaryExceptionType).toBe("PRICE_VARIANCE");
    expect(result.exceptions).toEqual([
      {
        type: "PRICE_VARIANCE",
        severity: "MEDIUM",
        invoiceUnitPriceMinor: 11000,
        poUnitPriceMinor: 10000,
        variancePct: 10,
        tolerancePct: 2,
        message: "Price variance 10.00% exceeds tolerance of 2%.",
      },
    ]);
  });

  describe("price tolerance boundary (exact cents)", () => {
    it("treats exactly 2% as within tolerance, where n8n's float check flags it", () => {
      // $1.02 vs $1.00: n8n computes 2.0000000000000018% and flags it.
      const atBoundary = transaction({
        invoice: { unitPriceMinor: 102 },
        purchaseOrder: { unitPriceMinor: 100 },
      });
      expect(runMatching(atBoundary).exceptionDetected).toBe(false);
    });

    it("flags one cent over the boundary", () => {
      const overBoundary = transaction({
        invoice: { unitPriceMinor: 10201 },
        purchaseOrder: { unitPriceMinor: 10000 },
      });
      expect(runMatching(overBoundary).primaryExceptionType).toBe(
        "PRICE_VARIANCE",
      );
    });

    it("flags favorable variances beyond tolerance", () => {
      const result = runMatching(
        transaction({ invoice: { unitPriceMinor: 9700 } }),
      );
      expect(result.exceptions[0]).toMatchObject({
        type: "PRICE_VARIANCE",
        variancePct: -3,
      });
    });

    it("skips the price check when the PO price is zero, as n8n does", () => {
      const result = runMatching(
        transaction({
          invoice: { unitPriceMinor: 500 },
          purchaseOrder: { unitPriceMinor: 0 },
        }),
      );
      expect(result.exceptionDetected).toBe(false);
    });
  });

  it("flags any quantity difference when quantity tolerance is 0", () => {
    const result = runMatching(transaction({ invoice: { quantity: 11 } }));
    expect(result.exceptions).toEqual([
      expect.objectContaining({
        type: "QUANTITY_VARIANCE",
        invoiceQuantity: 11,
        poQuantity: 10,
        variancePct: 10,
        message: "Quantity variance 10.00% exceeds tolerance of 0%.",
      }),
    ]);
  });

  it("compares fractional quantities exactly", () => {
    // 10.2 vs 10 at 2% is exactly on the boundary.
    const atBoundary = transaction({
      invoice: { quantity: 10.2 },
      matchingPolicy: { quantityTolerancePct: 2 },
    });
    expect(runMatching(atBoundary).exceptionDetected).toBe(false);
  });

  describe("missing receipt", () => {
    it("is required for THREE_WAY matching", () => {
      const result = runMatching(transaction({ goodsReceipt: null }));
      expect(result.primaryExceptionType).toBe("MISSING_RECEIPT");
    });

    it("is not required for TWO_WAY matching", () => {
      const result = runMatching(
        transaction({
          goodsReceipt: null,
          matchingPolicy: { matchType: "TWO_WAY" },
        }),
      );
      expect(result.exceptionDetected).toBe(false);
    });
  });

  it("reports only PO_NOT_FOUND when the PO is missing, even without a receipt", () => {
    const result = runMatching(
      transaction({ purchaseOrder: null, goodsReceipt: null }),
    );
    expect(result.exceptions.map((e) => e.type)).toEqual(["PO_NOT_FOUND"]);
    expect(result.exceptions[0].message).toBe(
      "Purchase order referenced by invoice INV-1 could not be found.",
    );
  });

  it("records every exception in n8n's order and picks the primary by priority", () => {
    const result = runMatching(
      transaction({
        invoice: { currency: "EUR", unitPriceMinor: 12000, quantity: 12 },
        goodsReceipt: null,
      }),
    );
    expect(result.exceptions.map((e) => e.type)).toEqual([
      "CURRENCY_MISMATCH",
      "PRICE_VARIANCE",
      "QUANTITY_VARIANCE",
      "MISSING_RECEIPT",
    ]);
    expect(result.exceptionCount).toBe(4);
    expect(result.primaryExceptionType).toBe("CURRENCY_MISMATCH");
  });

  it("compares prices across currencies with different minor units", () => {
    // 1500 JPY vs 1500.00 USD: same major value, no price variance.
    const result = runMatching(
      transaction({
        invoice: { currency: "JPY", unitPriceMinor: 1500 },
        purchaseOrder: { currency: "USD", unitPriceMinor: 150000 },
      }),
    );
    expect(result.exceptions.map((e) => e.type)).toEqual(["CURRENCY_MISMATCH"]);
  });
});

describe("exceedsTolerance", () => {
  it("is exclusive at the limit", () => {
    expect(exceedsTolerance(102, 100, 2)).toBe(false);
    expect(exceedsTolerance(98, 100, 2)).toBe(false);
    expect(exceedsTolerance(10201, 10000, 2)).toBe(true);
  });

  it("handles fractional tolerance percentages", () => {
    expect(exceedsTolerance(10250, 10000, 2.5)).toBe(false);
    expect(exceedsTolerance(10251, 10000, 2.5)).toBe(true);
  });
});

describe("decimalPlaces", () => {
  it("counts decimals, including exponent notation", () => {
    expect(decimalPlaces(10)).toBe(0);
    expect(decimalPlaces(10.25)).toBe(2);
    expect(decimalPlaces(1e-7)).toBe(7);
    expect(decimalPlaces(1.5e-7)).toBe(8);
  });
});
