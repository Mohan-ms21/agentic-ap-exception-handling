import Link from "next/link";
import type { ReactNode } from "react";
import { DocRef } from "@/components/doc-ref";
import { stepHref, stepIndex, WALKTHROUGH_STEPS } from "@/lib/walkthrough";

/** Frame for one walkthrough step: heading, key point, content, prev/next. */
export function StepPage({
  slug,
  lead,
  children,
}: {
  slug: string;
  /** The one idea this step demonstrates. */
  lead: ReactNode;
  children: ReactNode;
}) {
  const index = stepIndex(slug);
  const step = WALKTHROUGH_STEPS[index];
  const previous = WALKTHROUGH_STEPS[index - 1];
  const next = WALKTHROUGH_STEPS[index + 1];

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="font-medium">
            Step {index + 1} of {WALKTHROUGH_STEPS.length}
          </span>
          {[step.docSection, ...(step.relatedSections ?? [])].map((section) => (
            <DocRef key={section} section={section} />
          ))}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{step.title}</h1>
        <p className="max-w-3xl text-neutral-700 dark:text-neutral-300">
          {lead}
        </p>
      </header>

      {children}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4 text-sm dark:border-neutral-800">
        {previous ? (
          <Link
            href={stepHref(previous.slug)}
            className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            ← {previous.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link
            href={stepHref(next.slug)}
            className="rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            {next.title} →
          </Link>
        )}
      </footer>
    </article>
  );
}
