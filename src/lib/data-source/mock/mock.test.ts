import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/domain/money";
import { computePriceVariance } from "@/lib/domain/price-variance";
import type { ReviewDecision } from "@/lib/domain/schemas";
import {
  DataSourceError,
  exceptionDetailSchema,
  exceptionSummarySchema,
} from "../types";
import { createMockDataSource } from ".";
import { mockSeed } from "./fixtures";
import { usd } from "./fixtures/builders";

const reviewer = { name: "Test Reviewer", email: "test.reviewer@example.com" };
const fixedNow = new Date("2026-09-14T12:00:00Z");
const create = () => createMockDataSource({ now: () => fixedNow });

async function expectDataSourceError(
  promise: Promise<unknown>,
  code: DataSourceError["code"],
) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(DataSourceError);
  expect((error as DataSourceError).code).toBe(code);
}

describe("synthetic dataset", () => {
  it("uses only example.com contact details", () => {
    const emails = JSON.stringify(mockSeed).match(/[\w.+-]+@[\w.-]+/g) ?? [];
    expect(emails.length).toBeGreaterThan(0);
    expect(emails.every((e) => e.endsWith("@example.com"))).toBe(true);
  });

  it("has internally consistent invoice amounts", () => {
    for (const invoice of mockSeed.invoices) {
      let subtotal = 0;
      for (const line of invoice.lines) {
        expect(line.lineAmount.amountMinor).toBe(
          Math.round(line.unitPrice.amountMinor * line.quantity),
        );
        subtotal += line.lineAmount.amountMinor;
      }
      expect(invoice.subtotal.amountMinor).toBe(subtotal);
      expect(invoice.total.amountMinor).toBe(
        invoice.subtotal.amountMinor + invoice.tax.amountMinor,
      );
    }
  });

  it("proposes credit notes for exactly the overbilled amount", () => {
    for (const mockCase of mockSeed.cases) {
      const action = mockCase.proposal?.action;
      if (action?.type !== "request_credit_note") continue;
      const invoice = mockSeed.invoices.find(
        (i) => i.id === mockCase.invoiceId,
      )!;
      const po = mockSeed.purchaseOrders.find(
        (p) => p.poNumber === invoice.poNumber,
      )!;
      const { details } = computePriceVariance(invoice, po, mockSeed.policy);
      const overbilled = details.lines
        .filter((l) => l.direction === "unfavorable")
        .reduce((sum, l) => sum + l.extendedVariance.amountMinor, 0);
      expect(formatMoney(action.amount), mockCase.exceptionId).toBe(
        formatMoney(usd((overbilled / 100).toFixed(2))),
      );
    }
  });

  it("rejects a case whose documents are within tolerance", () => {
    const seed = structuredClone(mockSeed);
    const invoice = seed.invoices.find((i) => i.id === "inv-04801")!;
    invoice.lines[0].unitPrice = usd("3.10");
    expect(() => createMockDataSource({ seed })).toThrow(/within tolerance/);
  });
});

describe("listExceptions", () => {
  it("returns every case, newest first, matching the summary schema", async () => {
    const summaries = await create().listExceptions();
    expect(summaries.map((s) => s.id)).toEqual([
      "exc-1008",
      "exc-1006",
      "exc-1005",
      "exc-1004",
      "exc-1003",
      "exc-1002",
      "exc-1001",
      "exc-1007",
    ]);
    for (const summary of summaries) {
      expect(exceptionSummarySchema.safeParse(summary).success).toBe(true);
    }
  });

  it("derives status from proposal and decision history", async () => {
    const summaries = await create().listExceptions();
    const statusOf = (id: string) => summaries.find((s) => s.id === id)?.status;
    expect(statusOf("exc-1008")).toBe("pending_proposal");
    expect(statusOf("exc-1007")).toBe("resolved");
    expect(statusOf("exc-1001")).toBe("awaiting_review");
  });

  it("filters by status", async () => {
    const summaries = await create().listExceptions({
      status: ["resolved", "pending_proposal"],
    });
    expect(summaries.map((s) => s.id).sort()).toEqual(["exc-1007", "exc-1008"]);
  });
});

describe("getException", () => {
  it("returns a detail payload matching the contract schema", async () => {
    const source = create();
    for (const { id } of await source.listExceptions()) {
      const detail = await source.getException(id);
      expect(exceptionDetailSchema.safeParse(detail).success, id).toBe(true);
    }
  });

  it("returns null for an unknown id", async () => {
    expect(await create().getException("exc-9999")).toBeNull();
  });

  it("computes the expected variance for each scenario", async () => {
    const source = create();
    const details = async (id: string) =>
      (await source.getException(id))!.exception.details;

    // 3: only line 2 of 3 is out of tolerance.
    const multiLine = await details("exc-1003");
    expect(
      multiLine.lines.map((l) => l.exceedsPercentLimit || l.exceedsAmountLimit),
    ).toEqual([false, true, false]);

    // 4: every line within tolerance, invoice total over the limit.
    const aggregate = await details("exc-1004");
    expect(
      aggregate.lines.some(
        (l) => l.exceedsPercentLimit || l.exceedsAmountLimit,
      ),
    ).toBe(false);
    expect(aggregate.totalAbsoluteVariance).toEqual(usd("265.00"));
    expect(aggregate.exceedsInvoiceLimit).toBe(true);

    // 5: favorable variance beyond tolerance.
    const favorable = await details("exc-1005");
    expect(favorable.lines[0]).toMatchObject({
      direction: "favorable",
      variancePercent: -30,
    });
  });

  it("returns a copy that callers cannot use to mutate state", async () => {
    const source = create();
    const detail = (await source.getException("exc-1001"))!;
    detail.exception.status = "resolved";
    expect((await source.getException("exc-1001"))!.exception.status).toBe(
      "awaiting_review",
    );
  });
});

describe("submitDecision", () => {
  const creditNote = {
    type: "request_credit_note",
    amount: usd("275.00"),
  } as const;

  it("resolves on approval, stamps the server time and records an audit event", async () => {
    const source = create();
    const detail = await source.submitDecision("exc-1002", {
      outcome: "approved",
      finalAction: creditNote,
      reviewer,
      decidedAt: "2020-01-01T00:00:00Z",
    });
    expect(detail.exception.status).toBe("resolved");
    expect(detail.decision?.decidedAt).toBe(fixedNow.toISOString());
    expect(detail.auditTrail.at(-1)).toMatchObject({
      type: "decision_recorded",
      actor: { kind: "user", name: reviewer.name },
      message: "Approved: request a credit note for $275.00.",
    });
    expect((await source.getException("exc-1002"))!.exception.status).toBe(
      "resolved",
    );
  });

  it("resolves on an edit that changes the action", async () => {
    const detail = await create().submitDecision("exc-1002", {
      outcome: "edited",
      finalAction: { type: "request_credit_note", amount: usd("250.00") },
      comment: "Vendor agreed to $250.00 after freight adjustment.",
      reviewer,
      decidedAt: fixedNow.toISOString(),
    });
    expect(detail.exception.status).toBe("resolved");
  });

  it("escalates on rejection", async () => {
    const detail = await create().submitDecision("exc-1006", {
      outcome: "rejected",
      comment: "Buyer confirms the quote was never accepted.",
      reviewer,
      decidedAt: fixedNow.toISOString(),
    });
    expect(detail.exception.status).toBe("escalated");
    expect(detail.auditTrail.at(-1)?.message).toMatch(/^Rejected the proposal/);
  });

  it("rejects an approval whose action differs from the proposal", async () => {
    await expectDataSourceError(
      create().submitDecision("exc-1002", {
        outcome: "approved",
        finalAction: { type: "approve_at_invoice_price" },
        reviewer,
        decidedAt: fixedNow.toISOString(),
      }),
      "invalid_input",
    );
  });

  it("rejects an edit that keeps the proposed action", async () => {
    await expectDataSourceError(
      create().submitDecision("exc-1002", {
        outcome: "edited",
        finalAction: creditNote,
        comment: "No change.",
        reviewer,
        decidedAt: fixedNow.toISOString(),
      }),
      "invalid_input",
    );
  });

  it("rejects malformed input", async () => {
    await expectDataSourceError(
      create().submitDecision("exc-1002", {
        outcome: "rejected",
        reviewer,
        decidedAt: fixedNow.toISOString(),
      } as unknown as ReviewDecision),
      "invalid_input",
    );
  });

  it("refuses decisions on exceptions that are not awaiting review", async () => {
    const source = create();
    const approve: ReviewDecision = {
      outcome: "approved",
      finalAction: { type: "approve_at_invoice_price" },
      reviewer,
      decidedAt: fixedNow.toISOString(),
    };
    await expectDataSourceError(
      source.submitDecision("exc-1008", approve),
      "invalid_state",
    );
    await expectDataSourceError(
      source.submitDecision("exc-1007", approve),
      "invalid_state",
    );
  });

  it("reports unknown exceptions as not found", async () => {
    await expectDataSourceError(
      create().submitDecision("exc-9999", {
        outcome: "rejected",
        comment: "n/a",
        reviewer,
        decidedAt: fixedNow.toISOString(),
      }),
      "not_found",
    );
  });

  it("keeps state separate between instances", async () => {
    const first = create();
    await first.submitDecision("exc-1006", {
      outcome: "rejected",
      comment: "Escalating.",
      reviewer,
      decidedAt: fixedNow.toISOString(),
    });
    expect((await create().getException("exc-1006"))!.exception.status).toBe(
      "awaiting_review",
    );
  });
});
