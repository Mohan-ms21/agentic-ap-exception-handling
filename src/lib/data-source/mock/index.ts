import { z } from "zod";
import { formatMoney } from "@/lib/domain/money";
import { computePriceVariance } from "@/lib/domain/price-variance";
import {
  resolutionActionSchema,
  reviewDecisionSchema,
  type AgentProposal,
  type AuditEvent,
  type ExceptionStatus,
  type ResolutionAction,
  type ReviewDecision,
} from "@/lib/domain/schemas";
import {
  DataSourceError,
  type ExceptionDataSource,
  type ExceptionDetail,
  type ExceptionFilter,
  type ExceptionSummary,
} from "../types";
import { mockSeed } from "./fixtures";
import { mockSeedSchema, type MockSeed } from "./seed";

export type MockDataSourceOptions = {
  seed?: MockSeed;
  /** Clock used to timestamp decisions. */
  now?: () => Date;
};

/**
 * In-memory data source over the synthetic dataset. State lives in this
 * instance only: it resets when the server restarts and is not shared
 * between serverless instances.
 */
export function createMockDataSource(
  options: MockDataSourceOptions = {},
): ExceptionDataSource {
  const seed = mockSeedSchema.parse(options.seed ?? mockSeed);
  const now = options.now ?? (() => new Date());
  const records = new Map<string, ExceptionDetail>();
  for (const mockCase of seed.cases) {
    records.set(mockCase.exceptionId, buildDetail(seed, mockCase));
  }

  return {
    async listExceptions(filter?: ExceptionFilter) {
      return [...records.values()]
        .filter(
          (r) => !filter?.status || filter.status.includes(r.exception.status),
        )
        .sort((a, b) =>
          b.exception.detectedAt.localeCompare(a.exception.detectedAt),
        )
        .map(toSummary);
    },

    async getException(id: string) {
      const record = records.get(id);
      return record ? structuredClone(record) : null;
    },

    async submitDecision(id: string, input: ReviewDecision) {
      const parsed = reviewDecisionSchema.safeParse(input);
      if (!parsed.success) {
        throw new DataSourceError(
          "invalid_input",
          `Invalid decision:\n${z.prettifyError(parsed.error)}`,
        );
      }

      const record = records.get(id);
      if (!record) {
        throw new DataSourceError("not_found", `No exception with id ${id}.`);
      }
      const { proposal } = record;
      if (record.exception.status !== "awaiting_review" || !proposal) {
        throw new DataSourceError(
          "invalid_state",
          `Exception ${id} is ${record.exception.status}; only exceptions awaiting review accept a decision.`,
        );
      }

      // The server clock, not the client, timestamps the decision. With no
      // authentication in the demo, the reviewer is taken from the input.
      const decision: ReviewDecision = {
        ...parsed.data,
        decidedAt: now().toISOString(),
      };
      if (
        decision.outcome === "approved" &&
        !isSameAction(decision.finalAction, proposal.action)
      ) {
        throw new DataSourceError(
          "invalid_input",
          'An approval must take the proposed action. Use outcome "edited" to take a different one.',
        );
      }
      if (
        decision.outcome === "edited" &&
        isSameAction(decision.finalAction, proposal.action)
      ) {
        throw new DataSourceError(
          "invalid_input",
          'An edit must change the proposed action. Use outcome "approved" to accept it as proposed.',
        );
      }

      record.decision = decision;
      record.exception.status = deriveStatus(proposal, decision);
      record.auditTrail.push(
        decisionEvent(id, record.auditTrail.length + 1, decision),
      );
      return structuredClone(record);
    },
  };
}

function buildDetail(
  seed: MockSeed,
  mockCase: MockSeed["cases"][number],
): ExceptionDetail {
  const fail = (message: string): never => {
    throw new Error(`Mock seed, ${mockCase.exceptionId}: ${message}`);
  };

  const invoice =
    seed.invoices.find((i) => i.id === mockCase.invoiceId) ??
    fail(`invoice ${mockCase.invoiceId} not found`);
  const purchaseOrder =
    seed.purchaseOrders.find((po) => po.poNumber === invoice.poNumber) ??
    fail(`PO ${invoice.poNumber} not found`);
  const vendor =
    seed.vendors.find((v) => v.id === invoice.vendorId) ??
    fail(`vendor ${invoice.vendorId} not found`);
  if (purchaseOrder.vendorId !== vendor.id) {
    fail(`PO ${purchaseOrder.poNumber} belongs to a different vendor`);
  }

  const { proposal, decision } = mockCase;
  if (proposal && proposal.exceptionId !== mockCase.exceptionId) {
    fail("proposal is attached to a different exception");
  }
  if (decision && !proposal) {
    fail("has a decision but no proposal");
  }

  const variance = computePriceVariance(invoice, purchaseOrder, seed.policy);
  if (!variance.hasException) {
    fail("documents are within tolerance, so no exception would be raised");
  }

  const auditTrail: AuditEvent[] = [
    {
      id: `${mockCase.exceptionId}-evt-1`,
      at: mockCase.detectedAt,
      actor: { kind: "system", name: "Invoice matching" },
      type: "exception_detected",
      message: `Price variance detected on ${invoice.invoiceNumber} against ${purchaseOrder.poNumber}: ${formatMoney(variance.details.totalAbsoluteVariance)} total absolute variance.`,
    },
  ];
  if (proposal) {
    auditTrail.push({
      id: `${mockCase.exceptionId}-evt-2`,
      at: proposal.proposedAt,
      actor: {
        kind: "agent",
        name: `${proposal.producedBy.backend} agent (${proposal.producedBy.agentVersion})`,
      },
      type: "proposal_created",
      message: `Proposed: ${describeAction(proposal.action)} (${proposal.confidence} confidence).`,
    });
  }
  if (decision) {
    auditTrail.push(decisionEvent(mockCase.exceptionId, 3, decision));
  }

  return {
    exception: {
      id: mockCase.exceptionId,
      type: "price_variance",
      invoiceId: invoice.id,
      purchaseOrderId: purchaseOrder.id,
      vendorId: vendor.id,
      status: deriveStatus(proposal, decision),
      detectedAt: mockCase.detectedAt,
      details: variance.details,
    },
    invoice,
    purchaseOrder,
    goodsReceipts: seed.goodsReceipts.filter(
      (r) => r.purchaseOrderId === purchaseOrder.id,
    ),
    vendor,
    proposal,
    decision,
    auditTrail,
  };
}

function deriveStatus(
  proposal: AgentProposal | null,
  decision: ReviewDecision | null,
): ExceptionStatus {
  if (!proposal) return "pending_proposal";
  if (!decision) return "awaiting_review";
  return decision.outcome === "rejected" ? "escalated" : "resolved";
}

function toSummary(record: ExceptionDetail): ExceptionSummary {
  return structuredClone({
    id: record.exception.id,
    type: record.exception.type,
    status: record.exception.status,
    detectedAt: record.exception.detectedAt,
    invoiceNumber: record.invoice.invoiceNumber,
    poNumber: record.purchaseOrder.poNumber,
    vendorName: record.vendor.name,
    invoiceTotal: record.invoice.total,
    totalAbsoluteVariance: record.exception.details.totalAbsoluteVariance,
    proposal: record.proposal
      ? {
          action: record.proposal.action,
          confidence: record.proposal.confidence,
        }
      : null,
  });
}

function isSameAction(a: ResolutionAction, b: ResolutionAction): boolean {
  // Parsing normalizes key order, so serialized forms are comparable.
  return (
    JSON.stringify(resolutionActionSchema.parse(a)) ===
    JSON.stringify(resolutionActionSchema.parse(b))
  );
}

function describeAction(action: ResolutionAction): string {
  switch (action.type) {
    case "approve_at_invoice_price":
      return "approve at invoice price";
    case "request_credit_note":
      return `request a credit note for ${formatMoney(action.amount)}`;
    case "route_to_buyer":
      return "route to buyer";
    case "hold_for_investigation":
      return "hold for investigation";
  }
}

function decisionEvent(
  exceptionId: string,
  sequence: number,
  decision: ReviewDecision,
): AuditEvent {
  const comment = decision.comment ? ` Comment: ${decision.comment}` : "";
  const message =
    decision.outcome === "rejected"
      ? `Rejected the proposal; escalated for manual handling.${comment}`
      : `${decision.outcome === "approved" ? "Approved" : "Edited to"}: ${describeAction(decision.finalAction)}.${comment}`;
  return {
    id: `${exceptionId}-evt-${sequence}`,
    at: decision.decidedAt,
    actor: { kind: "user", name: decision.reviewer.name },
    type: "decision_recorded",
    message,
  };
}
