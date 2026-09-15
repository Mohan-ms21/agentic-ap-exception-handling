import Link from "next/link";
import {
  EvidenceVerificationResult,
  GovernanceResult,
} from "@/components/governance-panel";
import { StepPage } from "@/components/step-page";
import { CodeValue } from "@/components/ui/code-value";
import { KeyValues } from "@/components/ui/key-values";
import { Panel } from "@/components/ui/panel";
import { loadWalkthroughCase } from "@/lib/server/demo";
import { stepHref } from "@/lib/walkthrough";

const text = (value: string | null | undefined) =>
  value ? <CodeValue>{value}</CodeValue> : "—";

export default async function AuditStep() {
  const exceptionCase = await loadWalkthroughCase();
  const record = exceptionCase.auditRecord;

  return (
    <StepPage
      slug="audit"
      lead="Every outcome is written to an audit record that keeps the agent recommendation, the evidence, the policy decision, the human decision and the final outcome separate."
    >
      {!record ? (
        <Panel title="No audit record yet" variant="dashed">
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            The record is written when the case reaches an outcome: automated
            resolution, or an accept, override or escalate decision.{" "}
            <Link
              href={stepHref("review")}
              className="font-medium underline underline-offset-2"
            >
              Submit the review in step 7 →
            </Link>
          </p>
        </Panel>
      ) : (
        <>
          <Panel
            title="AP Exception Audit row"
            description="The columns written to the audit data table (§17.3)"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-left text-xs">
                <thead className="text-neutral-500 dark:text-neutral-400">
                  <tr>
                    {[
                      "caseID",
                      "invoiceID",
                      "poNumber",
                      "exceptionType",
                      "rootCause",
                      "recommendedAction",
                      "riskLevel",
                      "automationAllowed",
                      "humanDecision",
                      "finalAction",
                      "auditTimestamp",
                    ].map((column) => (
                      <th
                        key={column}
                        scope="col"
                        className="py-2 pr-3 font-mono font-medium"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-neutral-200 align-top dark:border-neutral-800">
                    {[
                      record.caseId,
                      record.transaction.invoiceId,
                      record.transaction.poNumber,
                      record.exception.type,
                      record.agentDecision?.rootCause,
                      record.agentDecision?.recommendedAction,
                      record.agentDecision?.riskLevel,
                      record.governance
                        ? String(record.governance.automationAllowed)
                        : null,
                      record.humanReview?.decision,
                      record.finalOutcome.nextAction,
                      record.auditTimestamp,
                    ].map((value, index) => (
                      <td
                        key={index}
                        className="py-2 pr-3 font-mono whitespace-nowrap"
                      >
                        {value ?? "—"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="1 · Deterministic match result">
              <KeyValues
                items={[
                  {
                    label: "Invoice",
                    value: text(record.transaction.invoiceNumber),
                  },
                  { label: "PO", value: text(record.transaction.poNumber) },
                  {
                    label: "Supplier",
                    value: text(record.transaction.supplierId),
                  },
                  {
                    label: "Exception type",
                    value: text(record.exception.type),
                  },
                ]}
              />
            </Panel>
            <Panel title="2 · Agent recommendation and 3 · evidence">
              {record.agentDecision ? (
                <div className="space-y-3">
                  <KeyValues
                    items={[
                      {
                        label: "Root cause",
                        value: text(record.agentDecision.rootCause),
                      },
                      {
                        label: "Recommended action",
                        value: text(record.agentDecision.recommendedAction),
                      },
                      {
                        label: "Risk",
                        value: text(record.agentDecision.riskLevel),
                      },
                      {
                        label: "Confidence",
                        value: text(String(record.agentDecision.confidence)),
                      },
                    ]}
                  />
                  <ul className="list-disc pl-5 text-sm">
                    {record.agentDecision.evidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                "—"
              )}
            </Panel>
            <Panel title="4 · Governance decision">
              {record.governance ? (
                <div className="space-y-3">
                  <GovernanceResult governance={record.governance} />
                  {record.governance.evidenceVerification && (
                    <EvidenceVerificationResult
                      verification={record.governance.evidenceVerification}
                    />
                  )}
                </div>
              ) : (
                "—"
              )}
            </Panel>
            <Panel title="5 · Human decision and 6 · final outcome">
              <KeyValues
                items={[
                  {
                    label: "Decision",
                    value: text(record.humanReview?.decision),
                  },
                  {
                    label: "Reviewer",
                    value: record.humanReview?.reviewer ?? "—",
                  },
                  { label: "Notes", value: record.humanReview?.notes || "—" },
                  {
                    label: "Workflow status",
                    value: text(record.finalOutcome.workflowStatus),
                  },
                  {
                    label: "Next action",
                    value: text(record.finalOutcome.nextAction),
                  },
                  {
                    label: "Versions",
                    value: `agent ${record.technicalContext.agentVersion} · matching ${record.technicalContext.matchingPolicyVersion}`,
                  },
                ]}
              />
            </Panel>
          </div>

          <details className="rounded-lg border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-950">
            <summary className="cursor-pointer font-medium">
              Audit record JSON (n8n Build Resolution Audit Record shape)
            </summary>
            <pre className="mt-3 overflow-x-auto text-xs">
              {JSON.stringify(record, null, 2)}
            </pre>
          </details>
        </>
      )}
    </StepPage>
  );
}
