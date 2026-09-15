import { MatchingExceptions } from "@/components/matching-exceptions";
import { StepPage } from "@/components/step-page";
import { TransactionFacts } from "@/components/transaction-facts";
import { CodeValue } from "@/components/ui/code-value";
import { KeyValues } from "@/components/ui/key-values";
import { Panel } from "@/components/ui/panel";
import { minorToMajor } from "@/lib/domain/money";
import { loadWalkthroughCase } from "@/lib/server/demo";

export default async function PriceVarianceStep() {
  const exceptionCase = await loadWalkthroughCase();
  const variance = exceptionCase.matchingResult.exceptions.find(
    (e) => e.type === "PRICE_VARIANCE",
  );
  const invoiceCurrency = exceptionCase.transaction.invoice.currency;
  const poCurrency =
    exceptionCase.transaction.purchaseOrder?.currency ?? invoiceCurrency;

  return (
    <StepPage
      slug="price-variance"
      lead="The price variance was calculated and detected by the matching engine before any AI ran. The agent will receive these facts; it did not calculate the variance and it cannot authorize a resolution."
    >
      {variance && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [
              "Invoice price",
              `${minorToMajor(variance.invoiceUnitPriceMinor, invoiceCurrency)}`,
            ],
            [
              "PO price",
              `${minorToMajor(variance.poUnitPriceMinor, poCurrency)}`,
            ],
            ["Tolerance", `${variance.tolerancePct}%`],
            ["Variance", `${variance.variancePct}%`],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950"
            >
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      <Panel title="Documents">
        <TransactionFacts transaction={exceptionCase.transaction} />
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Deterministic matching result">
          <MatchingExceptions result={exceptionCase.matchingResult} />
        </Panel>
        <Panel title="Exception case">
          <KeyValues
            items={[
              {
                label: "Case",
                value: <CodeValue>{exceptionCase.caseId}</CodeValue>,
              },
              {
                label: "Exception type",
                value: (
                  <CodeValue>
                    {exceptionCase.caseContext.exceptionType}
                  </CodeValue>
                ),
              },
              {
                label: "Received",
                value: exceptionCase.processingContext.receivedAt,
              },
              {
                label: "Routed to",
                value: "Price Variance Investigation Agent",
              },
            ]}
          />
        </Panel>
      </div>
    </StepPage>
  );
}
