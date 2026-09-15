/**
 * Text from outside the system (supplier data, tool responses, amendment
 * reasons, error messages). Rendered as inert text and marked untrusted:
 * instructions inside it are data, never commands (section 24.3).
 */
export function UntrustedText({
  text,
  label,
}: {
  text: string;
  label?: string;
}) {
  return (
    <figure className="rounded-md border border-dashed border-amber-400 bg-amber-50/60 p-2 dark:border-amber-700 dark:bg-amber-950/40">
      <figcaption className="mb-1 text-[0.7rem] font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-300">
        Untrusted data{label ? ` · ${label}` : ""}
      </figcaption>
      <blockquote className="font-mono text-xs break-words whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">
        {text}
      </blockquote>
    </figure>
  );
}
