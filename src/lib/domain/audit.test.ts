import { describe, expect, it } from "vitest";
import { auditRecordSchema, buildAuditRecord } from "./audit";

describe("buildAuditRecord", () => {
  const now = new Date("2026-09-01T09:05:00.000Z");

  it("builds the n8n audit record shape with technical context", () => {
    const record = buildAuditRecord(
      {
        caseId: "EXC-INV-EVAL-001-1788253200000",
        caseContext: {
          invoiceId: "INV-EVAL-001",
          invoiceNumber: "EVAL-INV-001",
          poNumber: "PO-EVAL-001",
          supplierId: "SUP-EVAL",
          exceptionType: "PRICE_VARIANCE",
        },
        agentDecision: null,
        governance: null,
        humanReview: null,
        workflowStatus: "READY_FOR_AUTOMATED_RESOLUTION",
        nextAction: "REMATCH_USING_AMENDED_PO",
      },
      now,
    );
    expect(auditRecordSchema.safeParse(record).success).toBe(true);
    expect(record).toMatchObject({
      transaction: { invoiceId: "INV-EVAL-001", supplierId: "SUP-EVAL" },
      exception: { type: "PRICE_VARIANCE" },
      finalOutcome: {
        workflowStatus: "READY_FOR_AUTOMATED_RESOLUTION",
        nextAction: "REMATCH_USING_AMENDED_PO",
      },
      technicalContext: {
        agentVersion: "1.0.0",
        matchingPolicyVersion: "DEMO-MATCH-1",
      },
      auditTimestamp: "2026-09-01T09:05:00.000Z",
    });
  });

  it("records empty strings and missing context as null, like n8n's `|| null`", () => {
    const record = buildAuditRecord(
      {
        caseId: "EXC-1",
        caseContext: { invoiceId: "", poNumber: undefined },
        agentDecision: null,
        governance: null,
        humanReview: null,
        workflowStatus: "HUMAN_OVERRIDE",
        nextAction: "",
      },
      now,
    );
    expect(record.transaction).toEqual({
      invoiceId: null,
      invoiceNumber: null,
      poNumber: null,
      supplierId: null,
    });
    expect(record.finalOutcome.nextAction).toBeNull();
  });
});
