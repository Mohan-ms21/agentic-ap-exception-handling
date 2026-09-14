import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsvRecords } from "../../../scripts/csv.mjs";
import { runMatching } from "@/lib/domain/matching";
import { batchIntakeRows } from "./batch-intake.generated";
import { buildInvoiceProcessingInput } from "./build-invoice-processing-input";

describe("batch intake demo data", () => {
  it("matches the batch CSV (run `npm run generate:data` if this fails)", () => {
    const csv = readFileSync(
      join(__dirname, "../../../data/batch/ap_batch_intake_demo_v2.csv"),
      "utf8",
    );
    expect(batchIntakeRows).toEqual(parseCsvRecords(csv));
  });

  it("uses only demo supplier and buyer names", () => {
    for (const row of batchIntakeRows) {
      expect(row.supplierName).toMatch(/^Demo Supplier [AB]$/);
      expect(row.buyer).toMatch(/^(Demo Buyer \d|)$/);
    }
  });

  // Section 7.3 of the solution documentation.
  it.each([
    ["INV-3001", null, "MATCHED"],
    ["INV-3002", "PRICE_VARIANCE", "EXCEPTION"],
    ["INV-3003", "QUANTITY_VARIANCE", "EXCEPTION"],
    ["INV-3004", "MISSING_RECEIPT", "EXCEPTION"],
    ["INV-3005", "CURRENCY_MISMATCH", "EXCEPTION"],
    ["INV-3006", "PO_NOT_FOUND", "EXCEPTION"],
  ])(
    "%s produces %s (%s) through the ported matching engine",
    (invoiceId, primary, status) => {
      const row = batchIntakeRows.find((r) => r.invoiceId === invoiceId)!;
      expect(row.batchId).toBe("BATCH-DEMO-001");
      const result = runMatching(buildInvoiceProcessingInput(row).transaction);
      expect(result.primaryExceptionType).toBe(primary);
      expect(result.matchStatus).toBe(status);
      // Each demo invoice exercises exactly one exception.
      expect(result.exceptionCount).toBe(primary ? 1 : 0);
    },
  );
});
