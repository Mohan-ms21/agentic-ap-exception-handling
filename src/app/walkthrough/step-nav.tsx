"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { stepHref, WALKTHROUGH_STEPS } from "@/lib/walkthrough";

export function StepNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Walkthrough steps">
      <p className="mb-2 hidden text-xs font-semibold tracking-wide text-neutral-500 uppercase lg:block dark:text-neutral-400">
        Walkthrough
      </p>
      <ol className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {WALKTHROUGH_STEPS.map((step, index) => {
          const active = pathname === stepHref(step.slug);
          return (
            <li key={step.slug} className="shrink-0">
              <Link
                href={stepHref(step.slug)}
                aria-current={active ? "step" : undefined}
                className={`flex items-baseline gap-2 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap ${
                  active
                    ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                    : "text-neutral-700 hover:bg-neutral-200/60 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                <span className="w-5 text-right font-mono text-xs tabular-nums opacity-70">
                  {index + 1}
                </span>
                {step.title}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
