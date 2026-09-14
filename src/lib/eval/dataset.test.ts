import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvRecords } from "../../../scripts/csv.mjs";
import { evalDatasetRows, evalFixtureRows } from "./dataset.generated";

const root = join(__dirname, "../../..");
const readCsv = (file: string) =>
  parseCsvRecords(readFileSync(join(root, "eval", file), "utf8"));

describe("parseCsv", () => {
  it("handles quoted commas, escaped quotes, embedded newlines and CRLF", () => {
    const text = 'a,b,c\r\n"x, y","say ""hi""","line 1\nline 2"\r\n';
    expect(parseCsv(text)).toEqual([
      ["a", "b", "c"],
      ["x, y", 'say "hi"', "line 1\nline 2"],
    ]);
  });

  it("keeps empty cells and ignores a trailing newline", () => {
    expect(parseCsv("a,,c\n,,\n")).toEqual([
      ["a", "", "c"],
      ["", "", ""],
    ]);
  });

  it("rejects rows whose cell count differs from the header", () => {
    expect(() => parseCsvRecords("a,b\n1,2,3\n")).toThrow(/row 2 has 3 cells/);
  });

  it("rejects an unterminated quoted field", () => {
    expect(() => parseCsv('a\n"open')).toThrow(/quoted field/);
  });
});

describe("generated eval dataset", () => {
  it("matches the dataset CSV (run `npm run generate:eval` if this fails)", () => {
    expect(evalDatasetRows).toEqual(
      readCsv("ap_price_variance_combined_eval_dataset_v4.csv"),
    );
  });

  it("matches the fixtures CSV (run `npm run generate:eval` if this fails)", () => {
    expect(evalFixtureRows).toEqual(
      readCsv("ap_price_variance_eval_fixtures_v4.csv"),
    );
  });

  it("has 4 CORE and 8 RED_TEAM cases, each with a tool fixture", () => {
    const suites = evalDatasetRows.map((r) => r.suite);
    expect(suites.filter((s) => s === "CORE")).toHaveLength(4);
    expect(suites.filter((s) => s === "RED_TEAM")).toHaveLength(8);

    const fixtureKeys = new Set(evalFixtureRows.map((r) => r.fixtureKey));
    for (const row of evalDatasetRows) {
      expect(fixtureKeys.has(row.fixtureKey), row.testCaseId).toBe(true);
    }
  });
});
