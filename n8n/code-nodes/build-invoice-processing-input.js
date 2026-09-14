// Extracted verbatim from the n8n Code node "Build Invoice Processing Input"
// (workflow "AP Batch Intake") by scripts/extract-n8n-code-nodes.mjs.
// Do not edit: re-run the extraction instead.

const row = $json;

const hasPO =
  row.poNumber &&
  row.poQuantity !== "" &&
  row.poQuantity !== null &&
  row.poUnitPrice !== "" &&
  row.poUnitPrice !== null;

const hasReceipt =
  String(row.receiptStatus).toUpperCase() === "RECEIVED" &&
  row.quantityReceived !== "" &&
  row.quantityReceived !== null;

return {
  json: {

    batchId: row.batchId,

    transaction: {

      invoice: {
        invoiceId: row.invoiceId,
        invoiceNumber: row.invoiceNumber,
        supplierId: row.supplierId,
        supplierName: row.supplierName,
        poNumber: row.poNumber,
        currency: row.invoiceCurrency,
        quantity: Number(row.invoiceQuantity),
        unitPrice: Number(row.invoiceUnitPrice)
      },

      purchaseOrder: hasPO
        ? {
            poNumber: row.poNumber,
            buyer: row.buyer,
            currency: row.poCurrency,
            quantity: Number(row.poQuantity),
            unitPrice: Number(row.poUnitPrice)
          }
        : null,

      goodsReceipt: hasReceipt
        ? {
            receiptNumber: `GR-${row.invoiceId}`,
            quantityReceived:
              Number(row.quantityReceived),
            status: "RECEIVED"
          }
        : null,

      matchingPolicy: {
        matchType: row.matchType,
        priceTolerancePct:
          Number(row.priceTolerancePct),
        quantityTolerancePct:
          Number(row.quantityTolerancePct)
      }
    },

    processingContext: {
      source: "BATCH_INTAKE",
      mode: "NORMAL",
      receivedAt: new Date().toISOString()
    }
  }
};
