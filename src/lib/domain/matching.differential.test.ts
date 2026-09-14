import { describe, expect, it } from "vitest";
import { loadN8nCodeNode, loadPatchedN8nCodeNode } from "@/test-utils/n8n-code";
import { matchingResultToWire, transactionFromWire } from "@/lib/n8n/convert";
import type { WireMatchingResult, WireTransaction } from "@/lib/n8n/wire";
import { exceedsTolerance, runMatching } from "./matching";

// Runs the original n8n "Deterministic Matching engine" node and the
// TypeScript port on the same transactions and compares the matchingResult.

const original = loadN8nCodeNode("deterministic-matching-engine");

// The one-line fixes proposed for the n8n node: compare in integer cents and
// basis points instead of floating-point percentages.
export const PRICE_CONDITION_ORIGINAL =
  "Math.abs(priceVariancePct) >\n      tolerance";
export const PRICE_CONDITION_FIXED =
  "Math.abs(Math.round(invoicePrice * 100) - Math.round(poPrice * 100)) * 10000 > Math.round(tolerance * 100) * Math.abs(Math.round(poPrice * 100))";
export const QUANTITY_CONDITION_ORIGINAL =
  "Math.abs(qtyVariancePct) >\n      quantityTolerance";
// Quantities are compared in thousandths, so the fix is exact for quantities
// with up to three decimal places (the port is exact for any quantity).
export const QUANTITY_CONDITION_FIXED =
  "Math.abs(Math.round(invoiceQty * 1000) - Math.round(poQty * 1000)) * 10000 > Math.round(quantityTolerance * 100) * Math.abs(Math.round(poQty * 1000))";

const patched = loadPatchedN8nCodeNode(
  "deterministic-matching-engine",
  (source) =>
    source
      .replace(PRICE_CONDITION_ORIGINAL, PRICE_CONDITION_FIXED)
      .replace(QUANTITY_CONDITION_ORIGINAL, QUANTITY_CONDITION_FIXED),
);

function originalResult(node: typeof original, wire: WireTransaction) {
  return node({ transaction: wire }).matchingResult as WireMatchingResult;
}

function portResult(wire: WireTransaction) {
  const transaction = transactionFromWire(wire);
  return matchingResultToWire(runMatching(transaction), transaction);
}

// Deterministic pseudo-random generator (mulberry32) so failures reproduce.
function random(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TOLERANCES = [0, 0.5, 1, 2, 2.5, 5, 10];

function generateTransactions(count: number): WireTransaction[] {
  const next = random(20260914);
  const pick = <T>(items: readonly T[]) =>
    items[Math.floor(next() * items.length)];
  const int = (min: number, max: number) =>
    min + Math.floor(next() * (max - min + 1));

  return Array.from({ length: count }, (_, i) => {
    const priceTolerancePct = pick(TOLERANCES);
    const quantityTolerancePct = pick(TOLERANCES);
    const poCents = pick([0, int(1, 500), int(1, 20000), int(1, 5_000_000)]);
    // Quantities in thousandths: whole units and fractional (e.g. 1.025 kg).
    const poMilli = pick([
      0,
      int(1, 10) * 1000,
      int(1, 1000) * 1000,
      int(1, 20000),
    ]);

    // A third of cases sit exactly on the tolerance boundary when that is
    // representable in whole cents / units; the rest vary freely.
    let invoiceCents =
      poCents + int(-poCents, poCents) * pick([0, 0, 1]) + int(-3, 3);
    let invoiceMilli = poMilli + pick([0, 0, int(-5, 5) * 1000, int(-50, 50)]);
    if (i % 3 === 0) {
      const priceStep = (poCents * priceTolerancePct * 100) / 10_000;
      if (Number.isInteger(priceStep))
        invoiceCents = poCents + pick([1, -1]) * priceStep;
      const qtyStep = (poMilli * quantityTolerancePct * 100) / 10_000;
      if (Number.isInteger(qtyStep))
        invoiceMilli = poMilli + pick([1, -1]) * qtyStep;
    }
    invoiceCents = Math.max(0, invoiceCents);
    const invoiceQuantity = Math.max(0, invoiceMilli) / 1000;
    const poQuantity = poMilli / 1000;

    const hasPo = next() > 0.1;
    return {
      invoice: {
        invoiceId: `INV-${i}`,
        invoiceNumber: `N-${i}`,
        supplierId: "SUP-TEST",
        supplierName: "Evaluation Supplier",
        poNumber: `PO-${i}`,
        currency: pick(["USD", "USD", "USD", "CAD"]),
        quantity: invoiceQuantity,
        unitPrice: invoiceCents / 100,
      },
      purchaseOrder: hasPo
        ? {
            poNumber: `PO-${i}`,
            buyer: "Evaluation Buyer",
            currency: pick(["USD", "USD", "USD", "CAD"]),
            quantity: poQuantity,
            unitPrice: poCents / 100,
          }
        : null,
      goodsReceipt:
        next() > 0.2
          ? {
              receiptNumber: `GR-${i}`,
              quantityReceived: invoiceQuantity,
              status: "RECEIVED",
            }
          : null,
      matchingPolicy: {
        matchType: pick(["TWO_WAY", "THREE_WAY"]),
        priceTolerancePct,
        quantityTolerancePct,
      },
    };
  });
}

const transactions = generateTransactions(2000);

/** True when a variance lands exactly on its tolerance limit. */
function isExactlyAtTolerance(wire: WireTransaction, type: string): boolean {
  const po = wire.purchaseOrder!;
  const policy = wire.matchingPolicy;
  const [actual, expected, tolerance] =
    type === "PRICE_VARIANCE"
      ? [
          Math.round(wire.invoice.unitPrice * 100),
          Math.round(po.unitPrice * 100),
          policy.priceTolerancePct,
        ]
      : [
          Math.round(wire.invoice.quantity * 1000),
          Math.round(po.quantity * 1000),
          policy.quantityTolerancePct,
        ];
  return (
    expected !== 0 &&
    Math.abs(actual - expected) * 10_000 ===
      Math.round(tolerance * 100) * Math.abs(expected) &&
    !exceedsTolerance(actual, expected, tolerance)
  );
}

describe("matching engine vs original n8n node", () => {
  it("agrees on the eval dataset's standard transaction", () => {
    const wire = transactions[1];
    expect(portResult(wire)).toEqual(originalResult(original, wire));
  });

  it("agrees everywhere except where n8n's float check flags an exactly-at-tolerance variance", () => {
    const divergences: string[] = [];
    let agreements = 0;

    for (const wire of transactions) {
      const expected = originalResult(original, wire);
      const actual = portResult(wire);
      if (JSON.stringify(actual) === JSON.stringify(expected)) {
        agreements++;
        continue;
      }
      // Every divergence must be an exception n8n adds and the port does not,
      // on a variance that sits exactly at the tolerance limit.
      const portTypes = new Set<string>(actual.exceptions.map((e) => e.type));
      const extra = expected.exceptions.filter(
        (e: { type: string }) => !portTypes.has(e.type),
      );
      expect(extra.length, JSON.stringify(wire)).toBeGreaterThan(0);
      for (const exception of extra) {
        expect(
          isExactlyAtTolerance(wire, exception.type),
          JSON.stringify(wire),
        ).toBe(true);
        divergences.push(exception.type);
      }
      const remaining = expected.exceptions.filter((e: { type: string }) =>
        portTypes.has(e.type),
      );
      expect(actual.exceptions).toEqual(remaining);
    }

    // The generator hits the float bug; if it stopped doing so this test
    // would no longer prove anything about the boundary.
    console.info(
      `n8n float-boundary divergences in ${transactions.length} transactions:`,
      {
        agreements,
        PRICE_VARIANCE: divergences.filter((t) => t === "PRICE_VARIANCE")
          .length,
        QUANTITY_VARIANCE: divergences.filter((t) => t === "QUANTITY_VARIANCE")
          .length,
      },
    );
    expect(divergences).toContain("PRICE_VARIANCE");
    expect(agreements).toBeGreaterThan(transactions.length * 0.8);
  });

  it("reproduces the documented case: $1.02 vs $1.00 at 2%", () => {
    const wire = { ...transactions[1] };
    wire.invoice = {
      ...wire.invoice,
      currency: "USD",
      unitPrice: 1.02,
      quantity: 10,
    };
    wire.purchaseOrder = {
      ...wire.purchaseOrder!,
      currency: "USD",
      unitPrice: 1,
      quantity: 10,
    };
    wire.goodsReceipt = {
      receiptNumber: "GR",
      quantityReceived: 10,
      status: "RECEIVED",
    };
    wire.matchingPolicy = {
      matchType: "THREE_WAY",
      priceTolerancePct: 2,
      quantityTolerancePct: 0,
    };

    expect(((1.02 - 1) / 1) * 100).toBe(2.0000000000000018);
    expect(originalResult(original, wire).exceptions).toEqual([
      expect.objectContaining({
        type: "PRICE_VARIANCE",
        message: "Price variance 2.00% exceeds tolerance of 2%.",
      }),
    ]);
    expect(portResult(wire).exceptionDetected).toBe(false);
    expect(originalResult(patched, wire).exceptionDetected).toBe(false);
  });

  it("reproduces the quantity case: 1.02 vs 1 unit at 2%", () => {
    const wire = { ...transactions[1] };
    wire.invoice = {
      ...wire.invoice,
      currency: "USD",
      unitPrice: 5,
      quantity: 1.02,
    };
    wire.purchaseOrder = {
      ...wire.purchaseOrder!,
      currency: "USD",
      unitPrice: 5,
      quantity: 1,
    };
    wire.goodsReceipt = {
      receiptNumber: "GR",
      quantityReceived: 1.02,
      status: "RECEIVED",
    };
    wire.matchingPolicy = {
      matchType: "THREE_WAY",
      priceTolerancePct: 2,
      quantityTolerancePct: 2,
    };

    expect(originalResult(original, wire).exceptions).toEqual([
      expect.objectContaining({ type: "QUANTITY_VARIANCE" }),
    ]);
    expect(portResult(wire).exceptionDetected).toBe(false);
    expect(originalResult(patched, wire).exceptionDetected).toBe(false);
  });

  it("agrees on every transaction once the one-line fixes are applied to the n8n node", () => {
    for (const wire of transactions) {
      expect(portResult(wire), JSON.stringify(wire)).toEqual(
        originalResult(patched, wire),
      );
    }
  });
});
