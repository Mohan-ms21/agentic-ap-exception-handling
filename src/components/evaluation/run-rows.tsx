import { Badge } from "@/components/ui/badge";
import type { EvaluationRun } from "@/lib/eval/runs";

const PassFail = ({ pass }: { pass: boolean }) =>
  pass ? <Badge tone="success">Pass</Badge> : <Badge tone="danger">Fail</Badge>;

/** Expected vs actual for each case in a run (section 31.9). */
export function RunRowsTable({ run }: { run: EvaluationRun }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[60rem] text-left text-xs">
        <thead className="text-neutral-500 dark:text-neutral-400">
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th scope="col" className="py-2 pr-3 font-medium">
              Case
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Root cause: expected / actual
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Action: expected / actual
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Governance: expected / actual
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Decision
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              False auto resolution
            </th>
            <th scope="col" className="py-2 font-medium">
              Notes
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 align-top dark:divide-neutral-800">
          {run.rows.map((row) => (
            <tr key={row.meta.testCaseId}>
              <td className="py-2 pr-3">
                <p className="font-mono font-medium">{row.meta.testCaseId}</p>
                <p className="text-neutral-500">
                  {row.meta.suite} · {row.meta.scenario}
                </p>
              </td>
              <td className="py-2 pr-3 font-mono">
                <p>{row.expected.rootCause}</p>
                <p
                  className={
                    row.metrics.rootCauseCorrect
                      ? "text-neutral-500"
                      : "text-red-700 dark:text-red-300"
                  }
                >
                  {row.actual.rootCause}
                </p>
              </td>
              <td className="py-2 pr-3 font-mono">
                <p>{row.expected.recommendedAction}</p>
                <p
                  className={
                    row.metrics.actionCorrect
                      ? "text-neutral-500"
                      : "text-red-700 dark:text-red-300"
                  }
                >
                  {row.actual.recommendedAction}
                </p>
              </td>
              <td className="py-2 pr-3 font-mono">
                <p>{row.expected.governanceCategory}</p>
                <p
                  className={
                    row.metrics.governanceCategoryCorrect
                      ? "text-neutral-500"
                      : "text-red-700 dark:text-red-300"
                  }
                >
                  {row.actual.governanceCategory}
                </p>
              </td>
              <td className="py-2 pr-3">
                <PassFail pass={row.metrics.overallDecisionCorrect === 1} />
              </td>
              <td className="py-2 pr-3">
                {row.metrics.falseAutoResolution === 1 ? (
                  <Badge tone="danger">Yes</Badge>
                ) : (
                  <Badge tone="success">No</Badge>
                )}
              </td>
              <td className="py-2 text-neutral-600 dark:text-neutral-400">
                {row.metrics.forbiddenRootCauseTriggered === 1 && (
                  <p>Forbidden root cause produced.</p>
                )}
                {row.metrics.forbiddenActionTriggered === 1 && (
                  <p>Forbidden action produced.</p>
                )}
                {row.metricDiscrepancies.length > 0 && (
                  <p>
                    Stored n8n metric column
                    {row.metricDiscrepancies.length > 1 ? "s" : ""} disagree
                    {row.metricDiscrepancies.length > 1 ? "" : "s"}:{" "}
                    {row.metricDiscrepancies.map((d) => d.metric).join(", ")}{" "}
                    (recomputed)
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        First line: expected (answer key). Second line: actual, in red where it
        differs.
      </p>
    </div>
  );
}
