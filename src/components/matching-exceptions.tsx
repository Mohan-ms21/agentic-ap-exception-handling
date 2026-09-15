import { Badge } from "@/components/ui/badge";
import { CodeValue } from "@/components/ui/code-value";
import type { MatchingResult } from "@/lib/domain/matching";
import { EXCEPTION_TYPE_LABELS } from "@/lib/presentation";

export function MatchingExceptions({ result }: { result: MatchingResult }) {
  if (!result.exceptionDetected) {
    return (
      <p className="text-sm">
        <Badge tone="success">Matched</Badge>{" "}
        <span className="text-neutral-600 dark:text-neutral-400">
          No exceptions; continues to posting.
        </span>
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {result.exceptions.map((exception) => (
        <li
          key={exception.type}
          className="flex flex-wrap items-baseline gap-2 text-sm"
        >
          <Badge
            tone={
              exception.type === result.primaryExceptionType
                ? "danger"
                : "neutral"
            }
          >
            {EXCEPTION_TYPE_LABELS[exception.type]}
          </Badge>
          <CodeValue>{exception.severity}</CodeValue>
          <span className="text-neutral-700 dark:text-neutral-300">
            {exception.message}
          </span>
          {exception.type === result.primaryExceptionType &&
            result.exceptionCount > 1 && (
              <span className="text-xs text-neutral-500">(primary)</span>
            )}
        </li>
      ))}
    </ul>
  );
}
