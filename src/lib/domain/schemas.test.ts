import { describe, expect, it } from "vitest";
import {
  moneySchema,
  resolutionActionSchema,
  reviewDecisionSchema,
} from "./schemas";

const reviewer = { name: "Demo Reviewer", email: "reviewer@example.com" };
const decidedAt = "2026-09-01T10:00:00Z";

describe("moneySchema", () => {
  it("accepts integer minor units with an ISO currency code", () => {
    expect(
      moneySchema.safeParse({ amountMinor: 1925, currency: "USD" }).success,
    ).toBe(true);
  });

  it("rejects fractional minor units and malformed currency codes", () => {
    expect(
      moneySchema.safeParse({ amountMinor: 19.25, currency: "USD" }).success,
    ).toBe(false);
    expect(
      moneySchema.safeParse({ amountMinor: 1925, currency: "usd" }).success,
    ).toBe(false);
  });
});

describe("resolutionActionSchema", () => {
  it("requires an amount for a credit note request", () => {
    expect(
      resolutionActionSchema.safeParse({ type: "request_credit_note" }).success,
    ).toBe(false);
  });

  it("rejects unknown action types", () => {
    expect(
      resolutionActionSchema.safeParse({ type: "pay_anyway" }).success,
    ).toBe(false);
  });
});

describe("reviewDecisionSchema", () => {
  const action = { type: "approve_at_invoice_price" };

  it("allows an approval without a comment", () => {
    const result = reviewDecisionSchema.safeParse({
      outcome: "approved",
      finalAction: action,
      reviewer,
      decidedAt,
    });
    expect(result.success).toBe(true);
  });

  it("requires a comment when the reviewer edits the proposal", () => {
    const result = reviewDecisionSchema.safeParse({
      outcome: "edited",
      finalAction: action,
      comment: "   ",
      reviewer,
      decidedAt,
    });
    expect(result.success).toBe(false);
  });

  it("requires a comment and no action when the reviewer rejects", () => {
    expect(
      reviewDecisionSchema.safeParse({
        outcome: "rejected",
        reviewer,
        decidedAt,
      }).success,
    ).toBe(false);

    const parsed = reviewDecisionSchema.parse({
      outcome: "rejected",
      comment: "Vendor confirmed the PO price; invoice will be reissued.",
      finalAction: action,
      reviewer,
      decidedAt,
    });
    expect(parsed).not.toHaveProperty("finalAction");
  });
});
