import type { ReactNode } from "react";

export function Panel({
  title,
  description,
  actions,
  children,
  variant = "default",
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** "dashed" marks content that is illustrative rather than a real result. */
  variant?: "default" | "dashed";
}) {
  const border =
    variant === "dashed"
      ? "border-dashed border-neutral-300 dark:border-neutral-700"
      : "border-neutral-200 dark:border-neutral-800";
  return (
    <section
      className={`rounded-lg border bg-white dark:bg-neutral-950 ${border}`}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">
                {description}
              </p>
            )}
          </div>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
