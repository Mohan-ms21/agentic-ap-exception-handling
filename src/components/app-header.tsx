import Link from "next/link";
import { DOCUMENTATION_URL, REPOSITORY_URL } from "@/lib/walkthrough";

export function AppHeader() {
  return (
    <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mx-auto flex min-h-14 w-full max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          AP Exception Resolution Agent
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          <a
            href={DOCUMENTATION_URL}
            target="_blank"
            rel="noreferrer"
            className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            Documentation
          </a>
          <a
            href={REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
            className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            Source
          </a>
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            Demo · synthetic data
          </span>
        </nav>
      </div>
    </header>
  );
}
