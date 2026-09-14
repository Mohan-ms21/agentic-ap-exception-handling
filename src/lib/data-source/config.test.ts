import { describe, expect, it } from "vitest";
import { DataSourceConfigError, resolveDataSourceName } from "./config";

describe("resolveDataSourceName", () => {
  it("defaults to mock when unset or blank", () => {
    expect(resolveDataSourceName(undefined)).toBe("mock");
    expect(resolveDataSourceName("  ")).toBe("mock");
  });

  it("accepts mock", () => {
    expect(resolveDataSourceName("mock")).toBe("mock");
  });

  it.each(["n8n", "langgraph"])(
    "rejects %s with a not-implemented message",
    (name) => {
      expect(() => resolveDataSourceName(name)).toThrow(DataSourceConfigError);
      expect(() => resolveDataSourceName(name)).toThrow(/not implemented yet/);
    },
  );

  it("rejects unknown values and lists the valid ones", () => {
    expect(() => resolveDataSourceName("postgres")).toThrow(
      /Expected one of: mock, n8n, langgraph/,
    );
  });
});
