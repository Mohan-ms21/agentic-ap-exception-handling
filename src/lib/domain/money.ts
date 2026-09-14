import type { CurrencyCode, Money } from "./schemas";

/** Number of minor-unit digits for a currency: 2 for USD, 0 for JPY. */
export function minorUnitDigits(currency: CurrencyCode): number {
  return (
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}

export function money(amountMinor: number, currency: CurrencyCode): Money {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError(
      `Minor-unit amount must be an integer: ${amountMinor}`,
    );
  }
  return { amountMinor, currency };
}

export function zeroMoney(currency: CurrencyCode): Money {
  return money(0, currency);
}

/**
 * Parses a decimal string in major units ("19.25") without going through
 * floating point. Rejects more decimal places than the currency allows.
 */
export function parseMoney(value: string, currency: CurrencyCode): Money {
  const digits = minorUnitDigits(currency);
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match || (match[3]?.length ?? 0) > digits) {
    throw new RangeError(`Invalid ${currency} amount: "${value}"`);
  }
  const [, sign, whole, fraction = ""] = match;
  const amountMinor = Number(whole + fraction.padEnd(digits, "0"));
  return money(sign ? -amountMinor : amountMinor, currency);
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new TypeError(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

/** Rounds half away from zero, so +0.5 and -0.5 round symmetrically. */
export function roundHalfAwayFromZero(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** Multiplies by a (possibly fractional) quantity, rounding to minor units. */
export function multiplyMoney(value: Money, factor: number): Money {
  return money(
    roundHalfAwayFromZero(value.amountMinor * factor),
    value.currency,
  );
}

export function absMoney(value: Money): Money {
  return money(Math.abs(value.amountMinor), value.currency);
}

export function sumMoney(
  values: readonly Money[],
  currency: CurrencyCode,
): Money {
  return values.reduce(addMoney, zeroMoney(currency));
}

export function formatMoney(value: Money, locale = "en-US"): string {
  const digits = minorUnitDigits(value.currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: value.currency,
  }).format(value.amountMinor / 10 ** digits);
}
