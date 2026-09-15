import { Badge } from "@/components/ui/badge";
import type { EvaluationAggregates, ReleaseGate } from "@/lib/eval/metrics";
import { formatRate } from "./format";

const SCOPES: Record<ReleaseGate["scope"], string> = {
  CORE: "CORE cases",
  RED_TEAM: "RED_TEAM cases",
  ALL: "All cases",
};

export function ReleaseGatesTable({ gates }: { gates: ReleaseGate[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead className="text-xs text-neutral-500 dark:text-neutral-400">
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th scope="col" className="py-2 pr-4 font-medium">
              Gate (§21.5)
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Scope
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Threshold
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Measured
            </th>
            <th scope="col" className="py-2 font-medium">
              Result
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {gates.map((gate) => (
            <tr key={gate.id}>
              <td className="py-2 pr-4 font-medium">{gate.label}</td>
              <td className="py-2 pr-4 text-neutral-600 dark:text-neutral-400">
                {SCOPES[gate.scope]}
              </td>
              <td className="py-2 pr-4 font-mono">{gate.threshold}</td>
              <td className="py-2 pr-4 tabular-nums">
                {typeof gate.measured === "number"
                  ? gate.measured
                  : formatRate(gate.measured)}
              </td>
              <td className="py-2">
                {gate.passed ? (
                  <Badge tone="success">Pass</Badge>
                ) : (
                  <Badge tone="danger">Fail</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const METRICS: {
  key: keyof Omit<EvaluationAggregates, "falseAutoResolution">;
  label: string;
}[] = [
  { key: "rootCauseAccuracy", label: "Root-cause accuracy" },
  { key: "actionAccuracy", label: "Action accuracy" },
  { key: "riskLevelAccuracy", label: "Risk-level accuracy" },
  { key: "humanReviewAccuracy", label: "Human-review accuracy" },
  { key: "automationAccuracy", label: "Automation accuracy" },
  { key: "governanceAccuracy", label: "Governance accuracy" },
  { key: "evidenceGrounding", label: "Evidence grounding" },
  { key: "overallDecisionAccuracy", label: "Overall decision accuracy" },
  { key: "redTeamPass", label: "Red-team pass (RED_TEAM cases)" },
];

export function AggregateMetrics({
  aggregates,
}: {
  aggregates: EvaluationAggregates;
}) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {METRICS.map(({ key, label }) => (
        <div
          key={key}
          className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
        >
          <dt className="text-xs text-neutral-500 dark:text-neutral-400">
            {label}
          </dt>
          <dd className="mt-1 text-sm font-medium tabular-nums">
            {formatRate(aggregates[key])}
          </dd>
        </div>
      ))}
    </dl>
  );
}
