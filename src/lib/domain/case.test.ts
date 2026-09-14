import { describe, expect, it } from "vitest";
import {
  applyAgentDecision,
  applyHumanReview,
  CaseTransitionError,
  exceptionCaseSchema,
  openCase,
  type OpenCaseInput,
} from "./case";
import type { AgentDecision } from "./resolution";
import type { HumanReview } from "./review";
import type { Transaction } from "./transaction";

const at = (iso: string) => new Date(iso);

const transaction: Transaction = {
  invoice: {
    invoiceId: "INV-EVAL-001",
    invoiceNumber: "EVAL-INV-001",
    supplierId: "SUP-EVAL",
    supplierName: "Evaluation Supplier",
    poNumber: "PO-EVAL-001",
    currency: "USD",
    quantity: 10,
    unitPriceMinor: 11000,
  },
  purchaseOrder: {
    poNumber: "PO-EVAL-001",
    buyer: "Evaluation Buyer",
    currency: "USD",
    quantity: 10,
    unitPriceMinor: 10000,
  },
  goodsReceipt: {
    receiptNumber: "GR-1",
    quantityReceived: 10,
    status: "RECEIVED",
  },
  matchingPolicy: {
    matchType: "THREE_WAY",
    priceTolerancePct: 2,
    quantityTolerancePct: 0,
  },
};

const input: OpenCaseInput = {
  batchId: "BATCH-DEMO-001",
  transaction,
  processingContext: {
    source: "BATCH_INTAKE",
    mode: "NORMAL",
    receivedAt: "2026-09-01T09:00:00.000Z",
  },
};

const approved: AgentDecision = {
  rootCause: "APPROVED_PO_AMENDMENT",
  recommendedAction: "REMATCH_USING_AMENDED_PO",
  riskLevel: "LOW",
  confidence: 0.97,
  evidence: ["AMD-EVAL-001 APPROVED at 110 USD."],
  requiresHumanReview: false,
  explanation: "Approved amendment.",
};

const pending: AgentDecision = {
  ...approved,
  rootCause: "UNAPPROVED_PO_AMENDMENT",
  recommendedAction: "ROUTE_TO_BUYER",
  riskLevel: "MEDIUM",
  requiresHumanReview: true,
};

const review = (overrides: Partial<HumanReview>): HumanReview => ({
  decision: "ACCEPT_RECOMMENDATION",
  reviewer: "AP Analyst",
  notes: "",
  overrideAction: "",
  reviewedAt: "2026-09-01T10:00:00.000Z",
  ...overrides,
});

describe("openCase", () => {
  it("opens a price variance case under agent investigation", () => {
    const opened = openCase(input, at("2026-09-01T09:00:01.000Z"));
    expect(exceptionCaseSchema.safeParse(opened).success).toBe(true);
    expect(opened).toMatchObject({
      caseId: `EXC-INV-EVAL-001-${at("2026-09-01T09:00:01.000Z").getTime()}`,
      investigationPath: "PRICE_VARIANCE_AGENT",
      workflowStatus: "UNDER_AGENT_INVESTIGATION",
      caseContext: { exceptionType: "PRICE_VARIANCE", supplierId: "SUP-EVAL" },
    });
  });

  it.each<[string, Partial<Transaction>]>([
    [
      "QUANTITY_VARIANCE",
      {
        invoice: {
          ...transaction.invoice,
          unitPriceMinor: 10000,
          quantity: 12,
        },
      },
    ],
    [
      "MISSING_RECEIPT",
      {
        invoice: { ...transaction.invoice, unitPriceMinor: 10000 },
        goodsReceipt: null,
      },
    ],
    [
      "CURRENCY_MISMATCH",
      {
        invoice: {
          ...transaction.invoice,
          currency: "EUR",
          unitPriceMinor: 10000,
        },
      },
    ],
    ["PO_NOT_FOUND", { purchaseOrder: null }],
  ])(
    "opens %s with no investigation path and no workflow status",
    (type, change) => {
      const opened = openCase({
        ...input,
        transaction: { ...transaction, ...change },
      });
      expect(opened).toMatchObject({
        investigationPath: "NONE",
        workflowStatus: null,
        caseContext: { exceptionType: type },
      });
      expect(() => applyAgentDecision(opened, null, approved)).toThrow(
        CaseTransitionError,
      );
    },
  );

  it("refuses to open a case for a clean match", () => {
    const clean = {
      ...transaction,
      invoice: { ...transaction.invoice, unitPriceMinor: 10000 },
    };
    expect(() => openCase({ ...input, transaction: clean })).toThrow(/matched/);
  });
});

describe("applyAgentDecision", () => {
  it("automates a safe decision, sets the rematch action and writes the audit record", () => {
    const now = at("2026-09-01T09:01:30.000Z");
    const resolved = applyAgentDecision(openCase(input), null, approved, now);
    expect(resolved).toMatchObject({
      workflowStatus: "READY_FOR_AUTOMATED_RESOLUTION",
      nextAction: "REMATCH_USING_AMENDED_PO",
      governance: {
        governanceCategory: "SAFE_AUTOMATION",
        automationAllowed: true,
      },
      humanReviewRequest: null,
      auditRecord: {
        finalOutcome: {
          workflowStatus: "READY_FOR_AUTOMATED_RESOLUTION",
          nextAction: "REMATCH_USING_AMENDED_PO",
        },
        humanReview: null,
        auditTimestamp: now.toISOString(),
      },
    });
  });

  it("sends anything else to human review with a pending request and no audit yet", () => {
    const waiting = applyAgentDecision(openCase(input), null, pending);
    expect(waiting).toMatchObject({
      workflowStatus: "WAITING_FOR_HUMAN_REVIEW",
      nextAction: null,
      auditRecord: null,
      humanReviewRequest: { status: "PENDING", formUrl: null },
    });
  });

  it("refuses a second decision", () => {
    const decided = applyAgentDecision(openCase(input), null, pending);
    expect(() => applyAgentDecision(decided, null, approved)).toThrow(
      CaseTransitionError,
    );
  });
});

describe("applyHumanReview", () => {
  const waiting = () => applyAgentDecision(openCase(input), null, pending);

  it("accept: completes review with the agent's action and audits it", () => {
    const done = applyHumanReview(waiting(), review({}));
    expect(done).toMatchObject({
      workflowStatus: "HUMAN_REVIEW_COMPLETED",
      nextAction: "ROUTE_TO_BUYER",
      auditRecord: { humanReview: { decision: "ACCEPT_RECOMMENDATION" } },
      dataQualityFlags: [],
    });
    expect(exceptionCaseSchema.safeParse(done).success).toBe(true);
  });

  it("override: takes the reviewer's action", () => {
    const done = applyHumanReview(
      waiting(),
      review({
        decision: "OVERRIDE_RECOMMENDATION",
        overrideAction: "HUMAN_REVIEW",
        notes: "Needs AP lead.",
      }),
    );
    expect(done).toMatchObject({
      workflowStatus: "HUMAN_OVERRIDE",
      nextAction: "HUMAN_REVIEW",
    });
  });

  it("escalate: routes to the AP manager", () => {
    const done = applyHumanReview(
      waiting(),
      review({ decision: "ESCALATE", notes: "Unclear." }),
    );
    expect(done).toMatchObject({
      workflowStatus: "ESCALATED",
      nextAction: "AP_MANAGER_REVIEW",
    });
  });

  it("records and flags an unroutable review but leaves the case waiting", () => {
    const stuck = applyHumanReview(waiting(), review({ decision: "APPROVE" }));
    expect(stuck.workflowStatus).toBe("WAITING_FOR_HUMAN_REVIEW");
    expect(stuck.auditRecord).toBeNull();
    expect(stuck.dataQualityFlags.map((f) => f.code)).toEqual([
      "UNKNOWN_REVIEW_DECISION",
    ]);
  });

  it("refuses a review on a case that is not waiting", () => {
    const automated = applyAgentDecision(openCase(input), null, approved);
    expect(() => applyHumanReview(automated, review({}))).toThrow(
      CaseTransitionError,
    );
  });
});
