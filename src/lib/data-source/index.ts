import "server-only";
import { resolveDataSourceName } from "./config";
import { createMockDataSource } from "./mock";
import type { ExceptionDataSource } from "./types";

export * from "./types";

// Cached on globalThis so dev-server hot reloads keep in-memory state.
const cache = globalThis as typeof globalThis & {
  __exceptionDataSource?: ExceptionDataSource;
};

/** The configured data source for this server process. */
export function getDataSource(): ExceptionDataSource {
  if (!cache.__exceptionDataSource) {
    const name = resolveDataSourceName(process.env.DATA_SOURCE);
    switch (name) {
      case "mock":
        cache.__exceptionDataSource = createMockDataSource();
        break;
    }
  }
  return cache.__exceptionDataSource;
}

/**
 * Discards in-memory demo state so the next request starts from the seeded
 * batch. Only meaningful for the mock backend, whose state is shared by every
 * visitor to this server process.
 */
export function resetDemoState(): boolean {
  if (resolveDataSourceName(process.env.DATA_SOURCE) !== "mock") return false;
  delete cache.__exceptionDataSource;
  return true;
}
