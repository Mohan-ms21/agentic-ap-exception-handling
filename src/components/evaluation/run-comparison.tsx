import { Badge } from "@/components/ui/badge";
import type { RunComparison } from "@/lib/eval/runs";
import { formatRate } from "./format";

const measured = (
  value: number | { value: number | null; passed: number; total: number },
) => (typeof value === "number" ? String(value) : formatRate(value));

export function RunComparisonView({
  comparison,
  beforeLabel,
  afterLabel,
}: {
  comparison: RunComparison;
  beforeLabel: string;
  afterLabel: string;
}) {
  const changed = comparison.rows.filter((row) => row.changed);
  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="text-xs text-neutral-500 dark:text-neutral-400">
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th scope="col" className="py-2 pr-4 font-medium">
                Gate
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Threshold
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                {beforeLabel}
              </th>
              <th scope="col" className="py-2 font-medium">
                {afterLabel}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {comparison.gates.map((gate) => (
              <tr key={gate.id}>
                <td className="py-2 pr-4 font-medium">{gate.label}</td>
                <td className="py-2 pr-4 font-mono">{gate.threshold}</td>
                {[gate.before, gate.after].map((result, index) => (
                  <td key={index} className="py-2 pr-4 tabular-nums">
                    <span className="mr-2">{measured(result.measured)}</span>
                    {result.passed ? (
                      <Badge tone="success">Pass</Badge>
                    ) : (
                      <Badge tone="danger">Fail</Badge>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-600 dark:text-neutral-400">
        A policy change can stop an unsafe automation, but it cannot make a
        manipulated agent&apos;s root cause correct: a red-team case can still
        fail on decision accuracy after hardening while no longer being a false
        auto resolution.
      </p>

      <div>
        <h3 className="text-sm font-semibold">
          Cases whose outcome changed ({changed.length})
        </h3>
        {changed.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            No case changed governance outcome.
          </p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {changed.map((row) => (
              <li
                key={row.testCaseId}
                className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
              >
                <p className="font-mono font-medium">
                  {row.testCaseId}{" "}
                  <span className="font-sans text-xs text-neutral-500">
                    {row.suite} · {row.scenario}
                  </span>
                </p>
                <p className="mt-1 font-mono text-xs break-words">
                  expected {row.expected.governanceCategory} · {beforeLabel}:{" "}
                  {row.before.governanceCategory}
                  {row.before.falseAutoResolution
                    ? " (false auto resolution)"
                    : ""}{" "}
                  → {afterLabel}: {row.after.governanceCategory}
                  {row.after.falseAutoResolution
                    ? " (false auto resolution)"
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
