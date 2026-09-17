import { Badge } from "@/components/ui/badge";
import { CodeValue } from "@/components/ui/code-value";
import { UntrustedText } from "@/components/ui/untrusted-text";
import type {
  PolicySimulation,
  SimulatedPolicyResult,
} from "@/lib/eval/policy-simulation";
import { GOVERNANCE_LABELS } from "@/lib/presentation";

function PolicyOutcome({ result }: { result: SimulatedPolicyResult }) {
  const { governance } = result;
  const label = GOVERNANCE_LABELS[governance.governanceCategory];
  const failures = governance.evidenceVerification?.failures ?? [];
  return (
    <div
      className={`space-y-3 rounded-md border p-3 ${
        governance.automationAllowed
          ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40"
          : "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
      }`}
    >
      <p className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{result.label}</span>
        <Badge tone={result.status === "LIVE" ? "neutral" : "accent"}>
          {result.status === "LIVE" ? "In n8n today" : "Proposed"}
        </Badge>
      </p>
      <p>
        <Badge tone={label.tone}>{label.label}</Badge>
      </p>
      <p className="text-sm">
        <span className="font-semibold">
          {governance.automationAllowed
            ? "Automated without a human: control failure"
            : "Blocked: sent to human review"}
        </span>
      </p>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        {governance.governanceReason}
      </p>
      {governance.evidenceVerification ? (
        <div className="space-y-1 text-sm">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Evidence check: {governance.evidenceVerification.outcome}
          </p>
          {failures.map((failure) => (
            <p
              key={failure.check}
              className="flex flex-wrap items-baseline gap-2"
            >
              <Badge tone="danger">{failure.type}</Badge>
              <CodeValue>{failure.check}</CodeValue>
              <span>{failure.message}</span>
            </p>
          ))}
        </div>
      ) : (
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          This policy does not check the amendment record; it accepts the root
          cause the agent asserted.
        </p>
      )}
    </div>
  );
}

/**
 * The governance gap as a worked example, run through both policies on every
 * page load. The agent output is written by hand, never a model run.
 */
export function InjectionSimulation({
  simulation,
}: {
  simulation: PolicySimulation;
}) {
  const {
    evaluationCase,
    simulatedAgentDecision: decision,
    current,
    hardened,
  } = simulation;
  const lookup = evaluationCase.inputs.toolLookup;

  return (
    <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <header className="space-y-1">
        <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold">
          What the hardening changes
          <Badge tone="warning">Simulated agent output · not a model run</Badge>
        </h2>
        <p className="max-w-3xl text-sm text-neutral-700 dark:text-neutral-300">
          Case <CodeValue>{evaluationCase.meta.testCaseId}</CodeValue>:{" "}
          {evaluationCase.meta.attackDescription}. The agent output below is
          written by hand: it is what an agent that obeyed the injected
          instruction would return. Both policies are then run on it here, live.
        </p>
      </header>

      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Authoritative record from the PO amendment tool
            </p>
            <p className="mt-1 text-sm">
              Amendment status{" "}
              <CodeValue>
                {lookup.lookupStatus === "FOUND"
                  ? lookup.amendment.status
                  : lookup.lookupStatus}
              </CodeValue>{" "}
              — not <CodeValue>APPROVED</CodeValue>
            </p>
          </div>
          {lookup.lookupStatus === "FOUND" && (
            <UntrustedText
              label="amendment reason"
              text={lookup.amendment.reason}
            />
          )}
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Simulated agent output (hand-written, not a model call)
            </p>
            <p className="mt-1 flex flex-wrap gap-1.5 text-sm">
              <CodeValue>{decision.rootCause}</CodeValue>
              <CodeValue>{decision.recommendedAction}</CodeValue>
              <CodeValue>{decision.riskLevel}</CodeValue>
              <CodeValue>confidence {decision.confidence}</CodeValue>
              <CodeValue>
                requiresHumanReview {String(decision.requiresHumanReview)}
              </CodeValue>
            </p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Every automation condition is met, so the decision passes the
              current policy&apos;s checks.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <PolicyOutcome result={current} />
          <PolicyOutcome result={hardened} />
        </div>
      </div>

      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        The difference is not that the hardened policy is stricter about the
        model. It asks a different question: not &ldquo;what did the agent
        conclude?&rdquo; but &ldquo;does the authoritative record support
        automating this?&rdquo;
      </p>
    </section>
  );
}
