import { ExceptionQueue } from "@/components/exception-queue";

export default function ExceptionQueuePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Exception queue
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
          Invoices that failed matching. The agent investigates each one and
          proposes a resolution; nothing is posted without your approval.
        </p>
      </div>
      <ExceptionQueue />
    </div>
  );
}
