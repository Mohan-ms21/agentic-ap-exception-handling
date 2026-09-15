import type { ReactNode } from "react";

/** An enum or identifier value as it appears in the data contract. */
export function CodeValue({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[0.8em] break-all dark:bg-neutral-900">
      {children}
    </code>
  );
}
