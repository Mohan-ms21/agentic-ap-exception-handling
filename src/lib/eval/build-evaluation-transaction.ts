import {
  evaluationExpectedSchema,
  evaluationMetaSchema,
  type EvaluationExpected,
  type EvaluationMeta,
} from "@/lib/domain/evaluation";
import type { ProcessingContext, Transaction } from "@/lib/domain/transaction";
import { transactionFromWire } from "@/lib/n8n/convert";

// Port of the n8n "Build Evaluation Transaction" Code node
// (n8n/code-nodes/build-evaluation-transaction.js): turns a row of the eval
// dataset into the same transaction envelope as a normal invoice, plus the
// evaluation metadata and answer key. Verified by
// build-evaluation-transaction.differential.test.ts.

export type EvalDatasetRow = Readonly<Record<string, string>>;

export type EvaluationTransaction = {
  evaluationMeta: EvaluationMeta;
  batchId: string;
  transaction: Transaction;
  processingContext: ProcessingContext;
  evaluationExpected: EvaluationExpected;
};

const toBoolean = (value: string) => value.toLowerCase() === "true";

export function buildEvaluationTransaction(
  row: EvalDatasetRow,
  now: Date = new Date(),
): EvaluationTransaction {
  return {
    evaluationMeta: evaluationMetaSchema.parse({
      testCaseId: row.testCaseId,
      suite: row.suite,
      scenario: row.scenario,
      severity: row.severity,
      redTeamCategory: row.redTeamCategory || null,
      attackDescription: row.attackDescription || null,
      fixtureKey: row.fixtureKey,
    }),
    batchId: `EVAL-${row.testCaseId}`,
    transaction: transactionFromWire({
      invoice: {
        invoiceId: row.invoiceId,
        invoiceNumber: row.invoiceNumber,
        supplierId: "SUP-EVAL",
        supplierName: row.supplierName,
        poNumber: row.poNumber,
        currency: row.invoiceCurrency,
        quantity: 10,
        unitPrice: Number(row.invoiceUnitPrice),
      },
      purchaseOrder: {
        poNumber: row.poNumber,
        buyer: "Evaluation Buyer",
        currency: row.poCurrency,
        quantity: 10,
        unitPrice: Number(row.poUnitPrice),
      },
      goodsReceipt: {
        receiptNumber: `GR-${row.testCaseId}`,
        quantityReceived: 10,
        status: "RECEIVED",
      },
      matchingPolicy: {
        matchType: "THREE_WAY",
        priceTolerancePct: Number(row.priceTolerancePct),
        quantityTolerancePct: 0,
      },
    }),
    processingContext: {
      source: "EVALUATION",
      mode: "EVALUATION",
      receivedAt: now.toISOString(),
    },
    evaluationExpected: evaluationExpectedSchema.parse({
      rootCause: row.expectedRootCause,
      recommendedAction: row.expectedAction,
      riskLevel: row.expectedRiskLevel,
      requiresHumanReview: toBoolean(row.expectedHumanReview),
      automationAllowed: toBoolean(row.expectedAutomationAllowed),
      governanceCategory: row.expectedGovernanceCategory,
      evidencePresent: toBoolean(row.expectedEvidencePresent),
      forbiddenRootCause: row.forbiddenRootCause || null,
      forbiddenAction: row.forbiddenAction || null,
    }),
  };
}
