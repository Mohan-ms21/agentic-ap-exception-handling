# Floating-point tolerance check in the n8n matching engine

**Found by:** the differential test that runs the n8n "Deterministic
Matching engine" Code node and its TypeScript port on the same inputs
(`src/lib/domain/matching.differential.test.ts`).

**Status:** fixed in the TypeScript port. Fix for the n8n node below,
verified by the same test.

## Summary

The matching engine decides whether a variance exceeds tolerance by
comparing a floating-point percentage with the tolerance:

```js
const priceVariancePct = ((invoicePrice - poPrice) / poPrice) * 100;
// ...
if (Math.abs(priceVariancePct) > tolerance) {
```

Binary floating point cannot represent most decimal prices exactly, so a
variance that is exactly at the tolerance can compute as slightly above
it, and is flagged as an exception.

| Invoice | PO      | Tolerance | Computed variance  | n8n           | Exact  |
| ------- | ------- | --------- | ------------------ | ------------- | ------ |
| $102.00 | $100.00 | 2%        | 2                  | within        | within |
| $1.02   | $1.00   | 2%        | 2.0000000000000018 | **exception** | within |
| $2.04   | $2.00   | 2%        | 2.0000000000000018 | **exception** | within |
| $0.51   | $0.50   | 2%        | 2.0000000000000018 | **exception** | within |
| $1.07   | $1.00   | 7%        | 7.000000000000006  | **exception** | within |
| $10.20  | $10.00  | 2%        | 1.9999999999999927 | within        | within |

The quantity check has the same defect and shows up more often, since
fractional quantities (for example 1.02 kg against 1 kg at 2%) are
common.

## Impact

Invoices whose variance sits exactly on the tolerance limit are raised as
exceptions and sent to agent investigation and, usually, human review.
The effect depends on the value, not on whether it is a boundary case, so
it is inconsistent: $102.00 vs $100.00 passes while $1.02 vs $1.00 does
not.

Over 2,000 generated transactions, the original node and the exact port
disagreed on 133 (10 price, 123 quantity). Every disagreement was the
n8n node raising an extra exception exactly at the limit; none was a
missed exception.

## Fix for the n8n node

Compare in integer cents (and thousandths of a unit for quantities) and
basis points instead of floating-point percentages. Each is a one-line
change to the `if` condition; the percentage variables are still used
for `variancePct` and the message.

**Price** (replace the condition of the `PRICE VARIANCE` block):

```js
if (Math.abs(Math.round(invoicePrice * 100) - Math.round(poPrice * 100)) * 10000 > Math.round(tolerance * 100) * Math.abs(Math.round(poPrice * 100))) {
```

**Quantity** (replace the condition of the `QUANTITY VARIANCE` block):

```js
if (Math.abs(Math.round(invoiceQty * 1000) - Math.round(poQty * 1000)) * 10000 > Math.round(quantityTolerance * 100) * Math.abs(Math.round(poQty * 1000))) {
```

Assumptions: prices have at most two decimal places (true for USD and
CAD in the current data), quantities at most three, and tolerance
percentages at most two. The TypeScript port has no such limits: it
scales each value to its own precision and compares with `BigInt`.

## Verification

`matching.differential.test.ts` applies exactly these two replacements to
a copy of the original node and requires it to agree with the port on all
2,000 generated transactions, including the boundary cases above.
