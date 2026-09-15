import { Badge } from "@/components/ui/badge";
import { CodeValue } from "@/components/ui/code-value";
import { KeyValues } from "@/components/ui/key-values";
import { UntrustedText } from "@/components/ui/untrusted-text";
import { formatMoney } from "@/lib/domain/money";
import type { PoAmendmentLookup } from "@/lib/domain/resolution";

const STATUS: Record<
  PoAmendmentLookup["lookupStatus"],
  { tone: "success" | "neutral" | "warning"; meaning: string }
> = {
  FOUND: {
    tone: "success",
    meaning: "The authoritative lookup succeeded and an amendment exists.",
  },
  NOT_FOUND: {
    tone: "neutral",
    meaning:
      "The authoritative lookup succeeded: no amendment exists for this PO.",
  },
  LOOKUP_FAILED: {
    tone: "warning",
    meaning:
      "The authoritative source was unavailable: whether an amendment exists is unknown. This is not the same as NOT_FOUND.",
  },
};

export function PoAmendmentResponse({ lookup }: { lookup: PoAmendmentLookup }) {
  const status = STATUS[lookup.lookupStatus];
  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={status.tone}>{lookup.lookupStatus}</Badge>
        <span className="text-neutral-700 dark:text-neutral-300">
          {status.meaning}
        </span>
      </p>
      {lookup.lookupStatus === "FOUND" && (
        <>
          <KeyValues
            items={[
              {
                label: "Amendment",
                value: <CodeValue>{lookup.amendment.amendmentId}</CodeValue>,
              },
              {
                label: "Status (authoritative)",
                value: (
                  <span className="flex flex-wrap items-center gap-2">
                    <CodeValue>{lookup.amendment.status}</CodeValue>
                    {lookup.amendment.status !== "APPROVED" && (
                      <span className="text-xs text-neutral-500">
                        not APPROVED
                      </span>
                    )}
                  </span>
                ),
              },
              {
                label: "Previous unit price",
                value: formatMoney({
                  amountMinor: lookup.amendment.previousUnitPriceMinor,
                  currency: lookup.amendment.currency,
                }),
              },
              {
                label: "Revised unit price",
                value: formatMoney({
                  amountMinor: lookup.amendment.revisedUnitPriceMinor,
                  currency: lookup.amendment.currency,
                }),
              },
            ]}
          />
          <UntrustedText
            label="amendment reason"
            text={lookup.amendment.reason}
          />
        </>
      )}
      {lookup.lookupStatus === "LOOKUP_FAILED" && (
        <>
          <p className="text-sm">
            Error code <CodeValue>{lookup.error.code}</CodeValue>
          </p>
          <UntrustedText
            label="tool error message"
            text={lookup.error.message}
          />
        </>
      )}
    </div>
  );
}
