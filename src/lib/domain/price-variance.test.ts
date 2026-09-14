import { describe, expect, it } from "vitest";
import { parseMoney } from "./money";
import { computePriceVariance } from "./price-variance";
import type { Invoice, PurchaseOrder, TolerancePolicy } from "./schemas";

const usd = (value: string) => parseMoney(value, "USD");

const policy: TolerancePolicy = {
  lineMaxVarianceBps: 200, // 2%
  lineMaxVariance: usd("50.00"),
  invoiceMaxVariance: usd("250.00"),
};

type LineSpec = { quantity: number; poPrice: string; invoicePrice: string };

// Builds a PO and invoice whose line N bills PO line N. Totals are not
// relevant to variance and are left at zero.
function documents(specs: LineSpec[]): {
  purchaseOrder: PurchaseOrder;
  invoice: Invoice;
} {
  const purchaseOrder: PurchaseOrder = {
    id: "po-test",
    poNumber: "PO-TEST",
    vendorId: "vendor-test",
    currency: "USD",
    status: "open",
    orderDate: "2026-07-01",
    buyer: { name: "Test Buyer", email: "buyer@example.com" },
    lines: specs.map((s, i) => ({
      lineNumber: i + 1,
      itemCode: `ITEM-${i + 1}`,
      description: `Item ${i + 1}`,
      quantityOrdered: s.quantity,
      unitOfMeasure: "EA",
      unitPrice: usd(s.poPrice),
    })),
  };
  const invoice: Invoice = {
    id: "inv-test",
    invoiceNumber: "INV-TEST",
    vendorId: "vendor-test",
    poNumber: "PO-TEST",
    currency: "USD",
    invoiceDate: "2026-08-01",
    receivedDate: "2026-08-02",
    dueDate: "2026-08-31",
    lines: specs.map((s, i) => ({
      lineNumber: i + 1,
      poLineNumber: i + 1,
      description: `Item ${i + 1}`,
      quantity: s.quantity,
      unitOfMeasure: "EA",
      unitPrice: usd(s.invoicePrice),
      lineAmount: usd("0.00"),
    })),
    subtotal: usd("0.00"),
    tax: usd("0.00"),
    total: usd("0.00"),
  };
  return { purchaseOrder, invoice };
}

function run(specs: LineSpec[]) {
  const { invoice, purchaseOrder } = documents(specs);
  return computePriceVariance(invoice, purchaseOrder, policy);
}

describe("computePriceVariance", () => {
  it("raises nothing when prices match", () => {
    const result = run([
      { quantity: 10, poPrice: "18.50", invoicePrice: "18.50" },
    ]);
    expect(result.hasException).toBe(false);
    expect(result.details.lines[0]).toMatchObject({
      direction: "none",
      variancePercent: 0,
      extendedVariance: usd("0.00"),
    });
  });

  describe("line percent limit (2%)", () => {
    it("treats exactly 2% as within tolerance", () => {
      const result = run([
        { quantity: 1, poPrice: "100.00", invoicePrice: "102.00" },
      ]);
      expect(result.details.lines[0].exceedsPercentLimit).toBe(false);
      expect(result.hasException).toBe(false);
    });

    it("flags anything over 2%, even by one cent", () => {
      const result = run([
        { quantity: 1, poPrice: "100.00", invoicePrice: "102.01" },
      ]);
      expect(result.details.lines[0].exceedsPercentLimit).toBe(true);
      expect(result.details.lines[0].variancePercent).toBe(2.01);
      expect(result.hasException).toBe(true);
    });
  });

  describe("line amount limit ($50)", () => {
    it("treats an extended variance of exactly $50 as within tolerance", () => {
      // 1% unit variance, so only the amount limit is in play.
      const result = run([
        { quantity: 500, poPrice: "10.00", invoicePrice: "10.10" },
      ]);
      expect(result.details.lines[0]).toMatchObject({
        extendedVariance: usd("50.00"),
        exceedsPercentLimit: false,
        exceedsAmountLimit: false,
      });
      expect(result.hasException).toBe(false);
    });

    it("flags an extended variance over $50 even when the percent is small", () => {
      const result = run([
        { quantity: 501, poPrice: "10.00", invoicePrice: "10.10" },
      ]);
      expect(result.details.lines[0]).toMatchObject({
        extendedVariance: usd("50.10"),
        exceedsPercentLimit: false,
        exceedsAmountLimit: true,
      });
      expect(result.hasException).toBe(true);
    });
  });

  it("applies tolerance to favorable variances too", () => {
    const result = run([
      { quantity: 200, poPrice: "32.00", invoicePrice: "22.40" },
    ]);
    expect(result.details.lines[0]).toMatchObject({
      direction: "favorable",
      variancePercent: -30,
      unitVariance: usd("-9.60"),
      extendedVariance: usd("-1920.00"),
      exceedsPercentLimit: true,
      exceedsAmountLimit: true,
    });
    expect(result.details.totalAbsoluteVariance).toEqual(usd("1920.00"));
    expect(result.hasException).toBe(true);
  });

  describe("invoice limit ($250)", () => {
    it("flags lines that are each within tolerance but together exceed $250", () => {
      const result = run([
        { quantity: 30, poPrice: "100.00", invoicePrice: "101.50" }, // $45
        { quantity: 12, poPrice: "250.00", invoicePrice: "254.00" }, // $48
        { quantity: 35, poPrice: "80.00", invoicePrice: "81.20" }, // $42
        { quantity: 50, poPrice: "45.00", invoicePrice: "45.80" }, // $40
        { quantity: 20, poPrice: "150.00", invoicePrice: "152.25" }, // $45
        { quantity: 45, poPrice: "60.00", invoicePrice: "61.00" }, // $45
      ]);
      expect(
        result.details.lines.every(
          (l) => !l.exceedsPercentLimit && !l.exceedsAmountLimit,
        ),
      ).toBe(true);
      expect(result.details.totalAbsoluteVariance).toEqual(usd("265.00"));
      expect(result.details.exceedsInvoiceLimit).toBe(true);
      expect(result.hasException).toBe(true);
    });

    it("sums absolute variances so over- and under-billing do not cancel out", () => {
      const result = run([
        { quantity: 100, poPrice: "10.00", invoicePrice: "10.15" }, // +$15 (1.5%)
        { quantity: 100, poPrice: "10.00", invoicePrice: "9.85" }, // -$15 (-1.5%)
      ]);
      expect(result.details.totalAbsoluteVariance).toEqual(usd("30.00"));
    });

    it("treats a total of exactly $250 as within tolerance", () => {
      const result = run([
        { quantity: 50, poPrice: "100.00", invoicePrice: "101.00" }, // $50
        { quantity: 50, poPrice: "100.00", invoicePrice: "101.00" },
        { quantity: 50, poPrice: "100.00", invoicePrice: "101.00" },
        { quantity: 50, poPrice: "100.00", invoicePrice: "101.00" },
        { quantity: 50, poPrice: "100.00", invoicePrice: "101.00" },
      ]);
      expect(result.details.totalAbsoluteVariance).toEqual(usd("250.00"));
      expect(result.details.exceedsInvoiceLimit).toBe(false);
      expect(result.hasException).toBe(false);
    });
  });

  it("excludes and reports invoice lines with no matching PO line", () => {
    const { invoice, purchaseOrder } = documents([
      { quantity: 1, poPrice: "10.00", invoicePrice: "10.00" },
    ]);
    invoice.lines.push(
      { ...invoice.lines[0], lineNumber: 2, poLineNumber: null },
      { ...invoice.lines[0], lineNumber: 3, poLineNumber: 99 },
    );
    const result = computePriceVariance(invoice, purchaseOrder, policy);
    expect(result.details.lines).toHaveLength(1);
    expect(result.unmatchedInvoiceLineNumbers).toEqual([2, 3]);
  });

  it("flags any variance against a zero PO price and omits the percent", () => {
    const result = run([
      { quantity: 1, poPrice: "0.00", invoicePrice: "0.01" },
    ]);
    expect(result.details.lines[0]).toMatchObject({
      variancePercent: null,
      exceedsPercentLimit: true,
    });
  });

  it("refuses to compare documents in different currencies", () => {
    const { invoice, purchaseOrder } = documents([
      { quantity: 1, poPrice: "10.00", invoicePrice: "10.00" },
    ]);
    expect(() =>
      computePriceVariance(
        invoice,
        { ...purchaseOrder, currency: "EUR" },
        policy,
      ),
    ).toThrow(TypeError);
  });
});
