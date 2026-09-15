import type { Rate } from "@/lib/eval/metrics";

export function formatRate(rate: Rate): string {
  if (rate.value === null) return "—";
  return `${Math.round(rate.value * 1000) / 10}% (${rate.passed}/${rate.total})`;
}
