// Extracted verbatim from the n8n Code node "Deterministic Matching engine"
// (workflow "AP Invoice processing") by scripts/extract-n8n-code-nodes.mjs.
// Do not edit: re-run the extraction instead.

const transaction = $json.transaction;

// -----------------------------------------------------
// 1. Validate transaction envelope
// -----------------------------------------------------

if (!transaction || typeof transaction !== "object") {
  throw new Error(
    "Transaction data is missing or invalid. Expected $json.transaction object."
  );
}

const invoice = transaction.invoice;
const po = transaction.purchaseOrder;
const receipt = transaction.goodsReceipt;
const policy = transaction.matchingPolicy;


// -----------------------------------------------------
// 2. Validate required information
// -----------------------------------------------------

if (!invoice) {
  throw new Error("Invoice data is missing");
}

if (!policy) {
  throw new Error("Matching policy is missing");
}


// -----------------------------------------------------
// 3. Collect matching exceptions
// -----------------------------------------------------

const exceptions = [];


// -----------------------------------------------------
// PO NOT FOUND
// -----------------------------------------------------

if (!po) {

  exceptions.push({
    type: "PO_NOT_FOUND",
    severity: "HIGH",
    message:
      `Purchase order referenced by invoice ${invoice.invoiceId} could not be found.`
  });

} else {

  // ---------------------------------------------------
  // CURRENCY MISMATCH
  // ---------------------------------------------------

  if (
    invoice.currency &&
    po.currency &&
    invoice.currency !== po.currency
  ) {

    exceptions.push({
      type: "CURRENCY_MISMATCH",
      severity: "HIGH",
      invoiceCurrency: invoice.currency,
      poCurrency: po.currency,
      message:
        `Invoice currency ${invoice.currency} does not match PO currency ${po.currency}.`
    });
  }


  // ---------------------------------------------------
  // PRICE VARIANCE
  // ---------------------------------------------------

  const invoicePrice = Number(invoice.unitPrice);
  const poPrice = Number(po.unitPrice);

  if (
    Number.isFinite(invoicePrice) &&
    Number.isFinite(poPrice) &&
    poPrice !== 0
  ) {

    const priceVariancePct =
      ((invoicePrice - poPrice) / poPrice) * 100;

    const tolerance =
      Number(policy.priceTolerancePct ?? 0);

    if (
      Math.abs(priceVariancePct) >
      tolerance
    ) {

      exceptions.push({
        type: "PRICE_VARIANCE",
        severity: "MEDIUM",
        invoiceUnitPrice: invoicePrice,
        poUnitPrice: poPrice,
        variancePct:
          Number(priceVariancePct.toFixed(2)),
        tolerancePct: tolerance,
        message:
          `Price variance ${priceVariancePct.toFixed(2)}% exceeds tolerance of ${tolerance}%.`
      });
    }
  }


  // ---------------------------------------------------
  // QUANTITY VARIANCE
  // ---------------------------------------------------

  const invoiceQty =
    Number(invoice.quantity);

  const poQty =
    Number(po.quantity);

  if (
    Number.isFinite(invoiceQty) &&
    Number.isFinite(poQty) &&
    poQty !== 0
  ) {

    const qtyVariancePct =
      ((invoiceQty - poQty) / poQty) * 100;

    const quantityTolerance =
      Number(
        policy.quantityTolerancePct ?? 0
      );

    if (
      Math.abs(qtyVariancePct) >
      quantityTolerance
    ) {

      exceptions.push({
        type: "QUANTITY_VARIANCE",
        severity: "MEDIUM",
        invoiceQuantity: invoiceQty,
        poQuantity: poQty,
        variancePct:
          Number(qtyVariancePct.toFixed(2)),
        tolerancePct:
          quantityTolerance,
        message:
          `Quantity variance ${qtyVariancePct.toFixed(2)}% exceeds tolerance of ${quantityTolerance}%.`
      });
    }
  }


  // ---------------------------------------------------
  // MISSING RECEIPT — only for 3-way matching
  // ---------------------------------------------------

  if (
    policy.matchType === "THREE_WAY" &&
    !receipt
  ) {

    exceptions.push({
      type: "MISSING_RECEIPT",
      severity: "MEDIUM",
      message:
        `Goods receipt is required for three-way matching but was not found.`
    });
  }
}


// -----------------------------------------------------
// 4. Determine primary exception
// -----------------------------------------------------

const priority = [
  "PO_NOT_FOUND",
  "CURRENCY_MISMATCH",
  "MISSING_RECEIPT",
  "QUANTITY_VARIANCE",
  "PRICE_VARIANCE"
];

let primaryExceptionType = null;

for (const type of priority) {

  if (
    exceptions.some(
      exception => exception.type === type
    )
  ) {

    primaryExceptionType = type;
    break;
  }
}


// -----------------------------------------------------
// 5. Build matching result
// -----------------------------------------------------

const exceptionDetected =
  exceptions.length > 0;

const matchingResult = {

  matchType:
    policy.matchType,

  exceptionDetected,

  exceptionCount:
    exceptions.length,

  primaryExceptionType,

  exceptions,

  matchStatus:
    exceptionDetected
      ? "EXCEPTION"
      : "MATCHED"
};


// -----------------------------------------------------
// 6. IMPORTANT — return original item + result
// -----------------------------------------------------

return {
  ...$json,
  matchingResult
};
