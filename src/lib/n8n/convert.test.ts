import { describe, expect, it } from "vitest";
import { runMatching } from "@/lib/domain/matching";
import {
  matchingResultFromWire,
  matchingResultToWire,
  N8nBoundaryError,
  processingContextFromWire,
  transactionFromWire,
  transactionToWire,
} from "./convert";
import type { WireTransaction } from "./wire";

const wire: WireTransaction = {
  invoice: {
    invoiceId: "INV-EVAL-001",
    invoiceNumber: "EVAL-INV-001",
    supplierId: "SUP-EVAL",
    supplierName: "Evaluation Supplier",
    poNumber: "PO-EVAL-001",
    currency: "USD",
    quantity: 10,
    unitPrice: 110,
  },
  purchaseOrder: {
    poNumber: "PO-EVAL-001",
    buyer: "Evaluation Buyer",
    currency: "USD",
    quantity: 10,
    unitPrice: 100,
  },
  goodsReceipt: {
    receiptNumber: "GR-PV-EVAL-001",
    quantityReceived: 10,
    status: "RECEIVED",
  },
  matchingPolicy: {
    matchType: "THREE_WAY",
    priceTolerancePct: 2,
    quantityTolerancePct: 0,
  },
};

describe("transactionFromWire", () => {
  it("converts major-unit prices to integer minor units", () => {
    const transaction = transactionFromWire(wire);
    expect(transaction.invoice.unitPriceMinor).toBe(11000);
    expect(transaction.purchaseOrder?.unitPriceMinor).toBe(10000);
  });

  it("uses each document's own currency for the conversion", () => {
    const transaction = transactionFromWire({
      ...wire,
      purchaseOrder: {
        ...wire.purchaseOrder!,
        currency: "JPY",
        unitPrice: 15000,
      },
    });
    expect(transaction.purchaseOrder?.unitPriceMinor).toBe(15000);
  });

  it("round-trips back to the identical n8n JSON", () => {
    for (const unitPrice of [0.01, 1.15, 2.04, 19.38, 110, 1234.56]) {
      const input = { ...wire, invoice: { ...wire.invoice, unitPrice } };
      expect(transactionToWire(transactionFromWire(input))).toEqual(input);
    }
    const noPo = { ...wire, purchaseOrder: null, goodsReceipt: null };
    expect(transactionToWire(transactionFromWire(noPo))).toEqual(noPo);
  });

  it("rejects prices with more precision than the currency allows", () => {
    expect(() =>
      transactionFromWire({
        ...wire,
        invoice: { ...wire.invoice, unitPrice: 110.005 },
      }),
    ).toThrow(/invoice\.unitPrice: .*more precision/);
  });

  it("rejects NaN produced by Number() on a blank cell", () => {
    expect(() =>
      transactionFromWire({
        ...wire,
        invoice: { ...wire.invoice, unitPrice: Number.NaN },
      }),
    ).toThrow(N8nBoundaryError);
  });

  it("rejects values the domain model does not allow", () => {
    expect(() =>
      transactionFromWire({
        ...wire,
        matchingPolicy: { ...wire.matchingPolicy, matchType: "FOUR_WAY" },
      }),
    ).toThrow(N8nBoundaryError);
    expect(() =>
      transactionFromWire({
        ...wire,
        goodsReceipt: { ...wire.goodsReceipt!, status: "PARTIAL" },
      }),
    ).toThrow(N8nBoundaryError);
  });
});

describe("processingContextFromWire", () => {
  it("requires receivedAt, which the trigger's JSON example omits", () => {
    expect(() =>
      processingContextFromWire({ source: "BATCH_INTAKE", mode: "NORMAL" }),
    ).toThrow(/receivedAt is required/);
    expect(
      processingContextFromWire({
        source: "BATCH_INTAKE",
        mode: "NORMAL",
        receivedAt: "2026-09-01T09:00:00.000Z",
      }).receivedAt,
    ).toBe("2026-09-01T09:00:00.000Z");
  });
});

describe("matching result conversion", () => {
  it("round-trips a price variance through n8n's major-unit JSON", () => {
    const transaction = transactionFromWire(wire);
    const result = runMatching(transaction);
    const asWire = matchingResultToWire(result, transaction);
    expect(asWire.exceptions[0]).toMatchObject({
      invoiceUnitPrice: 110,
      poUnitPrice: 100,
    });
    expect(matchingResultFromWire(asWire, transaction)).toEqual(result);
  });

  it("rejects a price variance reported without a PO", () => {
    const transaction = transactionFromWire(wire);
    const asWire = matchingResultToWire(runMatching(transaction), transaction);
    expect(() =>
      matchingResultFromWire(asWire, { ...transaction, purchaseOrder: null }),
    ).toThrow(/without a PO/);
  });
});
