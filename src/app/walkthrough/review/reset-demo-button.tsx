import { resetDemo } from "./actions";

export function ResetDemoButton() {
  return (
    <form action={resetDemo}>
      <button
        type="submit"
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        Reset demo
      </button>
    </form>
  );
}
