import { describe, expect, it } from "vitest";
import { transactionToWire } from "@/lib/n8n/convert";
import { loadN8nCodeNode } from "@/test-utils/n8n-code";
import { buildEvaluationTransaction } from "./build-evaluation-transaction";
import { evalDatasetRows } from "./dataset.generated";

const original = loadN8nCodeNode("build-evaluation-transaction");

describe("buildEvaluationTransaction vs original n8n node", () => {
  it.each(evalDatasetRows.map((row) => [row.testCaseId, row] as const))(
    "builds the same evaluation item for %s",
    (_, row) => {
      const port = buildEvaluationTransaction(row);
      const expected = original(row) as Record<string, Record<string, unknown>>;

      const { receivedAt: originalReceivedAt, ...originalContext } =
        expected.processingContext;
      const { receivedAt, ...portContext } = port.processingContext;
      expect(typeof originalReceivedAt).toBe("string");
      expect(typeof receivedAt).toBe("string");

      expect({
        evaluationMeta: port.evaluationMeta,
        batchId: port.batchId,
        transaction: transactionToWire(port.transaction),
        processingContext: portContext,
        evaluationExpected: port.evaluationExpected,
      }).toEqual({ ...expected, processingContext: originalContext });
    },
  );
});
