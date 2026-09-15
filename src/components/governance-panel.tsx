import { Badge } from "@/components/ui/badge";
import { CodeValue } from "@/components/ui/code-value";
import { Panel } from "@/components/ui/panel";
import {
  governancePolicyFor,
  priceVarianceAutomationCriteria,
  type EvidenceVerification,
  type Governance,
} from "@/lib/domain/governance";
import type { ExceptionType } from "@/lib/domain/matching";
import type { AgentDecision } from "@/lib/domain/resolution";
import { GOVERNANCE_LABELS } from "@/lib/presentation";

export function GovernanceResult({ governance }: { governance: Governance }) {
  const label = GOVERNANCE_LABELS[governance.governanceCategory];
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-center gap-2">
        <Badge tone={label.tone}>{label.label}</Badge>
        <span className="text-sm">
          automationAllowed{" "}
          <CodeValue>{String(governance.automationAllowed)}</CodeValue>
        </span>
      </p>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        {governance.governanceReason}
      </p>
      <p className="text-xs text-neutral-500">
        Evaluated {governance.evaluatedAt}
      </p>
    </div>
  );
}

export function AutomationCriteria({ decision }: { decision: AgentDecision }) {
  const criteria = priceVarianceAutomationCriteria(decision);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-left text-sm">
        <thead className="text-xs text-neutral-500 dark:text-neutral-400">
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th scope="col" className="py-2 pr-4 font-medium">
              Condition
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Required
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Agent output
            </th>
            <th scope="col" className="py-2 font-medium">
              Met
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {criteria.map((criterion) => (
            <tr key={criterion.field}>
              <td className="py-2 pr-4 font-mono text-xs">{criterion.field}</td>
              <td className="py-2 pr-4">
                <CodeValue>{criterion.requirement}</CodeValue>
              </td>
              <td className="py-2 pr-4">
                <CodeValue>{criterion.actual}</CodeValue>
              </td>
              <td className="py-2">
                {criterion.met ? (
                  <Badge tone="success">Yes</Badge>
                ) : (
                  <Badge tone="danger">No</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        Automation requires every condition. They are checked by code after the
        agent has finished.
      </p>
    </div>
  );
}

const EVIDENCE_OUTCOMES: Record<
  EvidenceVerification["outcome"],
  { tone: "success" | "warning" | "danger"; title: string; meaning: string }
> = {
  VERIFIED: {
    tone: "success",
    title: "Evidence verified",
    meaning: "The authoritative PO amendment record supports automation.",
  },
  LOOKUP_FAILED: {
    tone: "warning",
    title: "Lookup failed",
    meaning:
      "The evidence could not be retrieved, so the claim could not be verified. This is an outage, not a finding about the agent.",
  },
  CONTRADICTION: {
    tone: "danger",
    title: "Record contradicts the claim",
    meaning:
      "The lookup succeeded, but the authoritative record does not support automation.",
  },
};

export function EvidenceVerificationResult({
  verification,
}: {
  verification: EvidenceVerification;
}) {
  const outcome = EVIDENCE_OUTCOMES[verification.outcome];
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-center gap-2">
        <Badge tone={outcome.tone}>{outcome.title}</Badge>
        {verification.agentClaimedAutomation &&
          verification.outcome !== "VERIFIED" && (
            <span className="text-sm font-medium">
              {verification.outcome === "CONTRADICTION"
                ? "The agent made a claim the record does not support."
                : "The agent's claim could not be checked."}
            </span>
          )}
      </p>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        {outcome.meaning}
      </p>
      {verification.failures.length > 0 && (
        <ul className="space-y-1 text-sm">
          {verification.failures.map((failure) => (
            <li
              key={`${failure.type}-${failure.check}`}
              className="flex flex-wrap items-baseline gap-2"
            >
              <Badge
                tone={failure.type === "CONTRADICTION" ? "danger" : "warning"}
              >
                {failure.type}
              </Badge>
              <CodeValue>{failure.check}</CodeValue>
              <span>{failure.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * States the policy's known gap when it does not verify tool evidence.
 * Shown, not hidden: it was found by the red-team suite.
 */
export function PolicyEvidenceNote({
  exceptionType,
}: {
  exceptionType: ExceptionType;
}) {
  const policy = governancePolicyFor(exceptionType);
  if (policy.verifiesToolEvidence) return null;
  return (
    <Panel
      title={
        <span className="flex flex-wrap items-center gap-2">
          Known gap: this policy trusts the agent&apos;s root cause
          <Badge tone="accent">Found by the red-team suite</Badge>
        </span>
      }
    >
      <div className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
        <p>
          The current <CodeValue>{policy.n8nNode}</CodeValue> policy checks the
          fields the agent returned. It does not look at the PO amendment record
          itself. An agent manipulated into asserting{" "}
          <CodeValue>APPROVED_PO_AMENDMENT</CodeValue> with high confidence
          would meet every condition above.
        </p>
        <p>
          The tool set still bounds the damage: the only action that can be
          automated is a rematch against the amended PO, and the agent has no
          payment or supplier bank-detail tools. But the fix belongs in the
          policy: <strong>deterministic evidence validation</strong>. Before
          allowing automation, the policy runs its own PO amendment lookup and
          requires status exactly <CodeValue>APPROVED</CodeValue> and a revised
          price and currency equal to the invoice.
        </p>
        <p>
          The red-team suite found this. The hardened policy is being applied in
          n8n, evaluated against the same dataset, and will then be ported here;
          the evaluation step compares the two runs.
        </p>
      </div>
    </Panel>
  );
}
