import { describe, expect, it } from "vitest";
import { caseAgentDecision } from "@/lib/domain/case";
import { isExceptionCase } from "@/lib/domain/execution";
import type { HumanReviewSubmission } from "@/lib/domain/review";
import {
  DataSourceError,
  exceptionCaseSchema,
  invoiceExecutionSchema,
  invoiceExecutionSummarySchema,
} from "../types";
import { createMockDataSource } from ".";

const fixedNow = new Date("2026-09-09T15:40:00.000Z");
const create = () => createMockDataSource({ now: () => fixedNow });

async function caseIdFor(invoiceId: string, source = create()) {
  const execution = await source.getInvoiceExecution(invoiceId);
  if (!execution || !isExceptionCase(execution))
    throw new Error(`${invoiceId} has no case`);
  return { source, caseId: execution.caseId };
}

async function expectDataSourceError(
  promise: Promise<unknown>,
  code: DataSourceError["code"],
) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(DataSourceError);
  expect((error as DataSourceError).code).toBe(code);
}

describe("demo batch (section 31.2)", () => {
  it("lists the six BATCH-DEMO-001 invoices in batch order", async () => {
    const summaries = await create().listInvoiceExecutions();
    expect(summaries.map((s) => s.invoiceId)).toEqual([
      "INV-3001",
      "INV-3002",
      "INV-3003",
      "INV-3004",
      "INV-3005",
      "INV-3006",
    ]);
    for (const summary of summaries) {
      expect(summary.batchId).toBe("BATCH-DEMO-001");
      expect(
        invoiceExecutionSummarySchema.safeParse(summary).success,
        summary.invoiceId,
      ).toBe(true);
    }
  });

  it("returns executions that match the execution schema", async () => {
    const source = create();
    for (const { invoiceId } of await source.listInvoiceExecutions()) {
      const execution = await source.getInvoiceExecution(invoiceId);
      expect(
        invoiceExecutionSchema.safeParse(execution).success,
        invoiceId,
      ).toBe(true);
    }
  });

  it("INV-3001 matches and continues to posting without a case", async () => {
    const [summary] = await create().listInvoiceExecutions();
    expect(summary).toMatchObject({
      invoiceId: "INV-3001",
      matchStatus: "MATCHED",
      primaryExceptionType: null,
      caseId: null,
      workflowStatus: "MATCHED",
      nextAction: "CONTINUE_TO_POSTING",
    });
  });

  it("INV-3002 is investigated: one agent step, NOT_FOUND tool result, business review", async () => {
    const { source, caseId } = await caseIdFor("INV-3002");
    const exceptionCase = (await source.getCase(caseId))!;
    expect(exceptionCaseSchema.safeParse(exceptionCase).success).toBe(true);

    expect(exceptionCase.matchingResult.exceptions[0]).toMatchObject({
      type: "PRICE_VARIANCE",
      invoiceUnitPriceMinor: 11000,
      poUnitPriceMinor: 10000,
      variancePct: 10,
      tolerancePct: 2,
    });

    expect(exceptionCase.agentSteps).toHaveLength(1);
    expect(exceptionCase.agentSteps[0].toolCalls).toEqual([
      {
        toolName: "Get PO Amendment",
        input: { poNumber: "PO-3002" },
        response: {
          lookupStatus: "NOT_FOUND",
          poNumber: "PO-3002",
          amendment: null,
        },
      },
    ]);
    // Appendix A.2.
    expect(caseAgentDecision(exceptionCase)).toEqual({
      rootCause: "NO_AMENDMENT_FOUND",
      recommendedAction: "ROUTE_TO_BUYER",
      riskLevel: "MEDIUM",
      confidence: 1,
      evidence: ["PO amendment lookup returned NOT_FOUND."],
      requiresHumanReview: true,
      explanation: "No approved amendment was found to explain the variance.",
    });
    expect(exceptionCase).toMatchObject({
      workflowStatus: "WAITING_FOR_HUMAN_REVIEW",
      governance: {
        automationAllowed: false,
        governanceCategory: "BUSINESS_REVIEW_REQUIRED",
        evaluatedAt: "2026-09-09T15:34:18.182Z",
      },
      humanReviewRequest: { status: "PENDING" },
      auditRecord: null,
    });
  });

  it.each([
    ["INV-3003", "QUANTITY_VARIANCE"],
    ["INV-3004", "MISSING_RECEIPT"],
    ["INV-3005", "CURRENCY_MISMATCH"],
    ["INV-3006", "PO_NOT_FOUND"],
  ])(
    "%s is detected as %s with no investigation path",
    async (invoiceId, type) => {
      const summaries = await create().listInvoiceExecutions();
      expect(summaries.find((s) => s.invoiceId === invoiceId)).toMatchObject({
        matchStatus: "EXCEPTION",
        primaryExceptionType: type,
        investigationPath: "NONE",
        workflowStatus: null,
        governanceCategory: null,
      });
    },
  );

  it("keeps supplier and buyer names synthetic", async () => {
    const source = create();
    for (const { invoiceId } of await source.listInvoiceExecutions()) {
      const execution = (await source.getInvoiceExecution(invoiceId))!;
      expect(execution.transaction.invoice.supplierName).toBe(
        "Demo Supplier A",
      );
      expect(execution.transaction.purchaseOrder?.buyer ?? "").toMatch(
        /^(Demo Buyer \d)?$/,
      );
    }
  });
});

describe("submitHumanReview", () => {
  const accept: HumanReviewSubmission = {
    reviewDecision: "ACCEPT_RECOMMENDATION",
    reviewerName: "AP Analyst",
    reviewNotes: "Route this to Buyer",
  };

  it("accept (walkthrough 31.7): completes review and writes the audit record", async () => {
    const { source, caseId } = await caseIdFor("INV-3002");
    const done = await source.submitHumanReview(caseId, accept);
    expect(done).toMatchObject({
      workflowStatus: "HUMAN_REVIEW_COMPLETED",
      nextAction: "ROUTE_TO_BUYER",
      humanReview: {
        decision: "ACCEPT_RECOMMENDATION",
        reviewer: "AP Analyst",
        notes: "Route this to Buyer",
        overrideAction: "",
        reviewedAt: fixedNow.toISOString(),
      },
      auditRecord: {
        caseId,
        transaction: {
          invoiceId: "INV-3002",
          poNumber: "PO-3002",
          supplierId: "SUP-001",
        },
        exception: { type: "PRICE_VARIANCE" },
        agentDecision: { rootCause: "NO_AMENDMENT_FOUND" },
        finalOutcome: {
          workflowStatus: "HUMAN_REVIEW_COMPLETED",
          nextAction: "ROUTE_TO_BUYER",
        },
      },
    });
    const summary = (await source.listInvoiceExecutions()).find(
      (s) => s.invoiceId === "INV-3002",
    );
    expect(summary?.workflowStatus).toBe("HUMAN_REVIEW_COMPLETED");
  });

  it("override: takes the reviewer's action", async () => {
    const { source, caseId } = await caseIdFor("INV-3002");
    const done = await source.submitHumanReview(caseId, {
      reviewDecision: "OVERRIDE_RECOMMENDATION",
      reviewerName: "AP Analyst",
      reviewNotes: "Supplier to reissue at PO price.",
      overrideAction: "HUMAN_REVIEW",
    });
    expect(done).toMatchObject({
      workflowStatus: "HUMAN_OVERRIDE",
      nextAction: "HUMAN_REVIEW",
    });
  });

  it("escalate: routes to the AP manager", async () => {
    const { source, caseId } = await caseIdFor("INV-3002");
    const done = await source.submitHumanReview(caseId, {
      reviewDecision: "ESCALATE",
      reviewerName: "AP Analyst",
      reviewNotes: "Repeated variance with this supplier.",
    });
    expect(done).toMatchObject({
      workflowStatus: "ESCALATED",
      nextAction: "AP_MANAGER_REVIEW",
    });
  });

  it("rejects an override or escalation without notes", async () => {
    const { source, caseId } = await caseIdFor("INV-3002");
    await expectDataSourceError(
      source.submitHumanReview(caseId, {
        reviewDecision: "ESCALATE",
        reviewerName: "AP Analyst",
        reviewNotes: " ",
      }),
      "invalid_input",
    );
  });

  it("rejects an override action outside the four recommended actions", async () => {
    const { source, caseId } = await caseIdFor("INV-3002");
    await expectDataSourceError(
      source.submitHumanReview(caseId, {
        reviewDecision: "OVERRIDE_RECOMMENDATION",
        reviewerName: "AP Analyst",
        reviewNotes: "Pay it.",
        overrideAction: "PAY_SUPPLIER",
      } as unknown as HumanReviewSubmission),
      "invalid_input",
    );
  });

  it("refuses a review on a detection-only case", async () => {
    const { source, caseId } = await caseIdFor("INV-3003");
    await expectDataSourceError(
      source.submitHumanReview(caseId, accept),
      "invalid_state",
    );
  });

  it("refuses a second review", async () => {
    const { source, caseId } = await caseIdFor("INV-3002");
    await source.submitHumanReview(caseId, accept);
    await expectDataSourceError(
      source.submitHumanReview(caseId, accept),
      "invalid_state",
    );
  });

  it("reports unknown cases as not found", async () => {
    await expectDataSourceError(
      create().submitHumanReview("EXC-NOPE", accept),
      "not_found",
    );
  });

  it("keeps state separate between instances and returns copies", async () => {
    const { source, caseId } = await caseIdFor("INV-3002");
    const copy = (await source.getCase(caseId))!;
    copy.workflowStatus = "ESCALATED";
    expect((await source.getCase(caseId))?.workflowStatus).toBe(
      "WAITING_FOR_HUMAN_REVIEW",
    );

    await source.submitHumanReview(caseId, accept);
    expect((await create().getCase(caseId))?.workflowStatus).toBe(
      "WAITING_FOR_HUMAN_REVIEW",
    );
  });
});

describe("getEvaluationRuns", () => {
  it("has no model runs imported yet and a self-test labelled as such", async () => {
    const { modelRuns, selfTest } = await create().getEvaluationRuns();
    expect(modelRuns.map((r) => [r.slot.id, r.state.status])).toEqual([
      ["baseline", "NOT_IMPORTED"],
      ["hardened", "NOT_IMPORTED"],
    ]);
    expect(selfTest).toMatchObject({
      kind: "SELF_TEST",
      label: "Scoring pipeline self-test",
    });
  });
});
