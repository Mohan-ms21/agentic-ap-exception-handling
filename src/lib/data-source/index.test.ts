import { afterEach, describe, expect, it, vi } from "vitest";
import { getDataSource } from ".";

describe("getDataSource", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete (globalThis as { __exceptionDataSource?: unknown })
      .__exceptionDataSource;
  });

  it("returns the same mock instance across calls", () => {
    vi.stubEnv("DATA_SOURCE", "mock");
    expect(getDataSource()).toBe(getDataSource());
  });

  it("throws for a backend that is not implemented", () => {
    vi.stubEnv("DATA_SOURCE", "n8n");
    expect(() => getDataSource()).toThrow(/not implemented yet/);
  });
});
