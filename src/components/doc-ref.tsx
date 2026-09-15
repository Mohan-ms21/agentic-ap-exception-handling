import { DOCUMENTATION_URL } from "@/lib/walkthrough";

/** A reference to a section of the solution documentation. */
export function DocRef({ section }: { section: string }) {
  return (
    <a
      href={DOCUMENTATION_URL}
      target="_blank"
      rel="noreferrer"
      className="text-xs text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-neutral-800 dark:text-neutral-400 dark:decoration-neutral-700 dark:hover:text-neutral-200"
    >
      Documentation §{section}
    </a>
  );
}
