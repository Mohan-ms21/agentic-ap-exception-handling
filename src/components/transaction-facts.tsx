import { CodeValue } from "@/components/ui/code-value";
import { formatMoney } from "@/lib/domain/money";
import type { Transaction } from "@/lib/domain/transaction";

// The only UI component that reads header-level quantity and unit price.
// Invoices are single-line today, as in the n8n model; line-level data
// (section 27.6) would change this component and nothing else in the UI.

const EMPTY = <span className="text-neutral-400 dark:text-neutral-600">—</span>;

export function TransactionFacts({
  transaction,
}: {
  transaction: Transaction;
}) {
  const {
    invoice,
    purchaseOrder: po,
    goodsReceipt: receipt,
    matchingPolicy,
  } = transaction;
  const money = (amountMinor: number, currency: string) =>
    formatMoney({ amountMinor, currency });

  const rows: {
    label: string;
    invoice: React.ReactNode;
    po: React.ReactNode;
    receipt: React.ReactNode;
  }[] = [
    {
      label: "Document",
      invoice: <CodeValue>{invoice.invoiceNumber}</CodeValue>,
      po: po ? <CodeValue>{po.poNumber}</CodeValue> : EMPTY,
      receipt: receipt ? <CodeValue>{receipt.receiptNumber}</CodeValue> : EMPTY,
    },
    {
      label: "Currency",
      invoice: invoice.currency,
      po: po ? po.currency : EMPTY,
      receipt: EMPTY,
    },
    {
      label: "Quantity",
      invoice: invoice.quantity,
      po: po ? po.quantity : EMPTY,
      receipt: receipt ? receipt.quantityReceived : EMPTY,
    },
    {
      label: "Unit price",
      invoice: money(invoice.unitPriceMinor, invoice.currency),
      po: po ? money(po.unitPriceMinor, po.currency) : EMPTY,
      receipt: EMPTY,
    },
    {
      label: "Party",
      invoice: invoice.supplierName,
      po: po?.buyer ? po.buyer : EMPTY,
      receipt: receipt ? receipt.status : EMPTY,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="text-xs text-neutral-500 dark:text-neutral-400">
            <tr>
              <th scope="col" className="py-2 pr-4 font-medium">
                <span className="sr-only">Field</span>
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Invoice
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Purchase order
              </th>
              <th scope="col" className="py-2 font-medium">
                Goods receipt
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {rows.map((row) => (
              <tr key={row.label}>
                <th
                  scope="row"
                  className="py-2 pr-4 text-xs font-medium text-neutral-500 dark:text-neutral-400"
                >
                  {row.label}
                </th>
                <td className="py-2 pr-4 tabular-nums">{row.invoice}</td>
                <td className="py-2 pr-4 tabular-nums">{row.po}</td>
                <td className="py-2 tabular-nums">{row.receipt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Matching policy: <CodeValue>{matchingPolicy.matchType}</CodeValue>,
        price tolerance {matchingPolicy.priceTolerancePct}%, quantity tolerance{" "}
        {matchingPolicy.quantityTolerancePct}%. Supplier and buyer names are
        external data.
      </p>
    </div>
  );
}
