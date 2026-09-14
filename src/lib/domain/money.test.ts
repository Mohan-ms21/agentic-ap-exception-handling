import { describe, expect, it } from "vitest";
import {
  addMoney,
  formatMoney,
  majorToMinor,
  minorToMajor,
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

describe("majorToMinor", () => {
  it("converts major-unit numbers to integer minor units", () => {
    expect(majorToMinor(110, "USD")).toBe(11000);
    expect(majorToMinor(-9.6, "USD")).toBe(-960);
    expect(majorToMinor(1500, "JPY")).toBe(1500);
  });

  it("absorbs floating-point noise from the source value", () => {
    expect(1.15 * 100).not.toBe(115);
    expect(majorToMinor(1.15, "USD")).toBe(115);
    expect(majorToMinor(0.1 + 0.2, "USD")).toBe(30);
  });

  it("rejects more precision than the currency allows instead of rounding", () => {
    expect(() => majorToMinor(110.005, "USD")).toThrow(/more precision/);
    expect(() => majorToMinor(1500.5, "JPY")).toThrow(/more precision/);
  });

  it("rejects non-finite values", () => {
    expect(() => majorToMinor(Number.NaN, "USD")).toThrow(/finite/);
    expect(() => majorToMinor(Infinity, "USD")).toThrow(/finite/);
  });

  it("round-trips through minorToMajor", () => {
    for (const value of [0, 0.01, 1.02, 2.04, 19.38, 110, 1234567.89]) {
      expect(minorToMajor(majorToMinor(value, "USD"), "USD")).toBe(value);
    }
  });
});
