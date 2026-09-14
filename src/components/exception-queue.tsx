const columns = [
  "Invoice",
  "Vendor",
  "Exception",
  "Variance",
  "Agent proposal",
  "Status",
];

// Renders the queue structure only. Rows arrive once the mock data source
// is wired in; until then the empty state is the only state.
export function ExceptionQueue() {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Invoice exceptions awaiting review
          </caption>
          <thead className="bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="px-4 py-3 font-medium whitespace-nowrap"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>
      {/* Kept outside the scrollable table so it stays readable on narrow screens. */}
      <div className="px-4 py-16 text-center text-sm">
        <p className="font-medium">No exceptions in the queue</p>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          Invoices that fail matching will appear here for review.
        </p>
      </div>
    </div>
  );
}
