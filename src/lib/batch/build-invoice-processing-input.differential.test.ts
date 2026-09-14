import { describe, expect, it } from "vitest";
import { transactionToWire } from "@/lib/n8n/convert";
import { loadN8nCodeNode } from "@/test-utils/n8n-code";
import { batchIntakeRows } from "./batch-intake.generated";
import { buildInvoiceProcessingInput } from "./build-invoice-processing-input";

const original = loadN8nCodeNode("build-invoice-processing-input");

describe("buildInvoiceProcessingInput vs original n8n node", () => {
  it.each(batchIntakeRows.map((row) => [row.invoiceId, row] as const))(
    "builds the same processing input for %s",
    (_, row) => {
      const port = buildInvoiceProcessingInput(row);
      const expected = original(row) as {
        processingContext: Record<string, unknown>;
      };
      const { receivedAt: originalReceivedAt, ...originalContext } =
        expected.processingContext;
      const { receivedAt, ...portContext } = port.processingContext;
      expect(typeof originalReceivedAt).toBe("string");
      expect(typeof receivedAt).toBe("string");

      expect({
        batchId: port.batchId,
        transaction: transactionToWire(port.transaction),
        processingContext: portContext,
      }).toEqual({ ...expected, processingContext: originalContext });
    },
  );

  it("treats null data-table cells like empty CSV cells, as the n8n node does", () => {
    const row = {
      ...batchIntakeRows[0],
      poQuantity: null,
      quantityReceived: null,
    };
    const expected = original(row) as { transaction: Record<string, unknown> };
    const port = buildInvoiceProcessingInput(row);
    expect(expected.transaction.purchaseOrder).toBeNull();
    expect(expected.transaction.goodsReceipt).toBeNull();
    expect(port.transaction.purchaseOrder).toBeNull();
    expect(port.transaction.goodsReceipt).toBeNull();
  });
});
