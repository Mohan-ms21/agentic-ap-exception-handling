import { agentBackendSchema } from "@/lib/domain/schemas";

// Resolves the DATA_SOURCE env var. Deliberately free of server-only imports
// so it can run from instrumentation at startup and in unit tests.

const IMPLEMENTED = ["mock"] as const;

export type ImplementedDataSourceName = (typeof IMPLEMENTED)[number];

export class DataSourceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataSourceConfigError";
  }
}

function isImplemented(name: string): name is ImplementedDataSourceName {
  return (IMPLEMENTED as readonly string[]).includes(name);
}

/** Defaults to "mock"; throws for unknown or not-yet-implemented values. */
export function resolveDataSourceName(
  raw: string | undefined,
): ImplementedDataSourceName {
  const value = raw?.trim() || "mock";
  const parsed = agentBackendSchema.safeParse(value);
  if (!parsed.success) {
    throw new DataSourceConfigError(
      `DATA_SOURCE="${value}" is not valid. Expected one of: ${agentBackendSchema.options.join(", ")}.`,
    );
  }
  if (!isImplemented(parsed.data)) {
    throw new DataSourceConfigError(
      `DATA_SOURCE="${value}" is not implemented yet. Available: ${IMPLEMENTED.join(", ")}.`,
    );
  }
  return parsed.data;
}
