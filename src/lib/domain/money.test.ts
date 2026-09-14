import { describe, expect, it } from "vitest";
import {
  addMoney,
  formatMoney,
  minorUnitDigits,
  money,
  multiplyMoney,
  parseMoney,
  sumMoney,
} from "./money";

describe("parseMoney", () => {
  it("converts decimal strings to minor units without floating point", () => {
    expect(parseMoney("19.25", "USD")).toEqual(money(1925, "USD"));
    expect(parseMoney("0.1", "USD")).toEqual(money(10, "USD"));
    expect(parseMoney("-9.60", "USD")).toEqual(money(-960, "USD"));
    expect(parseMoney("1500", "JPY")).toEqual(money(1500, "JPY"));
  });

  it("rejects more decimal places than the currency allows", () => {
    expect(() => parseMoney("0.125", "USD")).toThrow(RangeError);
    expect(() => parseMoney("10.5", "JPY")).toThrow(RangeError);
    expect(() => parseMoney("abc", "USD")).toThrow(RangeError);
  });
});

describe("arithmetic", () => {
  it("rounds products half away from zero", () => {
    expect(multiplyMoney(money(1999, "USD"), 2.5).amountMinor).toBe(4998);
    expect(multiplyMoney(money(-1999, "USD"), 2.5).amountMinor).toBe(-4998);
  });

  it("refuses to combine different currencies", () => {
    expect(() => addMoney(money(100, "USD"), money(100, "EUR"))).toThrow(
      TypeError,
    );
  });

  it("sums to zero in the given currency for an empty list", () => {
    expect(sumMoney([], "USD")).toEqual(money(0, "USD"));
  });

  it("rejects non-integer minor units", () => {
    expect(() => money(10.5, "USD")).toThrow(RangeError);
  });
});

describe("formatting", () => {
  it("uses the currency's minor-unit digits", () => {
    expect(minorUnitDigits("USD")).toBe(2);
    expect(minorUnitDigits("JPY")).toBe(0);
    expect(formatMoney(money(192500, "USD"))).toBe("$1,925.00");
    expect(formatMoney(money(-960, "USD"))).toBe("-$9.60");
  });
});
