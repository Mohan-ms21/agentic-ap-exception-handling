import {
  absMoney,
  multiplyMoney,
  roundHalfAwayFromZero,
  subtractMoney,
  sumMoney,
} from "./money";
import type {
  Invoice,
  InvoiceLine,
  PriceVarianceDetails,
  PriceVarianceLine,
  PurchaseOrder,
  PurchaseOrderLine,
  TolerancePolicy,
} from "./schemas";

export type PriceVarianceResult = {
  details: PriceVarianceDetails;
  /** True if any line, or the invoice as a whole, is out of tolerance. */
  hasException: boolean;
  /**
   * Invoice lines with no matching PO line. They are excluded from price
   * variance; detecting them belongs to a separate exception type.
   */
  unmatchedInvoiceLineNumbers: number[];
};

/**
 * Compares invoice unit prices against the PO and applies the tolerance
 * policy (see tolerancePolicySchema for the exact rules). Invoice, PO and
 * policy must share one currency; currency conversion is out of scope.
 */
export function computePriceVariance(
  invoice: Invoice,
  purchaseOrder: PurchaseOrder,
  policy: TolerancePolicy,
): PriceVarianceResult {
  const currency = invoice.currency;
  const currencies = [
    purchaseOrder.currency,
    policy.lineMaxVariance.currency,
    policy.invoiceMaxVariance.currency,
  ];
  if (currencies.some((c) => c !== currency)) {
    throw new TypeError(
      `Invoice ${invoice.invoiceNumber} (${currency}) cannot be compared with PO ${purchaseOrder.poNumber} (${purchaseOrder.currency}) under a ${policy.lineMaxVariance.currency} policy`,
    );
  }

  const poLines = new Map(purchaseOrder.lines.map((l) => [l.lineNumber, l]));
  const lines: PriceVarianceLine[] = [];
  const unmatchedInvoiceLineNumbers: number[] = [];

  for (const invoiceLine of invoice.lines) {
    const poLine =
      invoiceLine.poLineNumber === null
        ? undefined
        : poLines.get(invoiceLine.poLineNumber);
    if (poLine) {
      lines.push(evaluateLine(invoiceLine, poLine, policy));
    } else {
      unmatchedInvoiceLineNumbers.push(invoiceLine.lineNumber);
    }
  }

  const totalAbsoluteVariance = sumMoney(
    lines.map((l) => absMoney(l.extendedVariance)),
    currency,
  );
  const exceedsInvoiceLimit =
    totalAbsoluteVariance.amountMinor > policy.invoiceMaxVariance.amountMinor;

  return {
    details: { policy, lines, totalAbsoluteVariance, exceedsInvoiceLimit },
    hasException:
      exceedsInvoiceLimit ||
      lines.some((l) => l.exceedsPercentLimit || l.exceedsAmountLimit),
    unmatchedInvoiceLineNumbers,
  };
}

function evaluateLine(
  invoiceLine: InvoiceLine,
  poLine: PurchaseOrderLine,
  policy: TolerancePolicy,
): PriceVarianceLine {
  const unitVariance = subtractMoney(invoiceLine.unitPrice, poLine.unitPrice);
  const extendedVariance = multiplyMoney(unitVariance, invoiceLine.quantity);
  const diff = unitVariance.amountMinor;
  const poPrice = poLine.unitPrice.amountMinor;

  // Integer comparison: |diff| / poPrice > bps / 10_000, without division.
  const exceedsPercentLimit =
    poPrice === 0
      ? diff !== 0
      : Math.abs(diff) * 10_000 > policy.lineMaxVarianceBps * Math.abs(poPrice);

  return {
    invoiceLineNumber: invoiceLine.lineNumber,
    poLineNumber: poLine.lineNumber,
    quantity: invoiceLine.quantity,
    poUnitPrice: poLine.unitPrice,
    invoiceUnitPrice: invoiceLine.unitPrice,
    unitVariance,
    variancePercent:
      poPrice === 0
        ? null
        : roundHalfAwayFromZero((diff / poPrice) * 10_000) / 100,
    extendedVariance,
    direction: diff > 0 ? "unfavorable" : diff < 0 ? "favorable" : "none",
    exceedsPercentLimit,
    exceedsAmountLimit:
      Math.abs(extendedVariance.amountMinor) >
      policy.lineMaxVariance.amountMinor,
  };
}
