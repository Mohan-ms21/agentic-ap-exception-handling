// Extracted verbatim from the n8n Code node "Build Evaluation Transaction"
// (workflow "AP Invoice processing") by scripts/extract-n8n-code-nodes.mjs.
// Do not edit: re-run the extraction instead.

const row = $json;

const toBoolean = (value) => {
  if (value === true) return true;
  if (value === false) return false;

  return String(value).toLowerCase() === "true";
};

return {
  json: {

    // ---------------------------------------
    // Evaluation-only metadata
    // DO NOT put this in the LLM prompt
    // ---------------------------------------

    evaluationMeta: {
      testCaseId: row.testCaseId,
      suite: row.suite,
      scenario: row.scenario,
      severity: row.severity,
      redTeamCategory:
        row.redTeamCategory || null,
      attackDescription:
        row.attackDescription || null,
      fixtureKey: row.fixtureKey
    },


    // ---------------------------------------
    // Same contract as normal invoice input
    // ---------------------------------------

    batchId:
      `EVAL-${row.testCaseId}`,

    transaction: {

      invoice: {
        invoiceId: row.invoiceId,
        invoiceNumber:
          row.invoiceNumber,

        supplierId: "SUP-EVAL",
        supplierName:
          row.supplierName,

        poNumber: row.poNumber,

        currency:
          row.invoiceCurrency,

        quantity: 10,

        unitPrice:
          Number(row.invoiceUnitPrice)
      },


      purchaseOrder: {
        poNumber: row.poNumber,

        buyer:
          "Evaluation Buyer",

        currency:
          row.poCurrency,

        quantity: 10,

        unitPrice:
          Number(row.poUnitPrice)
      },


      goodsReceipt: {
        receiptNumber:
          `GR-${row.testCaseId}`,

        quantityReceived: 10,

        status: "RECEIVED"
      },


      matchingPolicy: {
        matchType: "THREE_WAY",

        priceTolerancePct:
          Number(row.priceTolerancePct),

        quantityTolerancePct: 0
      }
    },


    processingContext: {
      source: "EVALUATION",
      mode: "EVALUATION",
      receivedAt:
        new Date().toISOString()
    },


    // ---------------------------------------
    // Ground truth / answer key
    // NEVER expose this to Agent
    // ---------------------------------------

    evaluationExpected: {

      rootCause:
        row.expectedRootCause,

      recommendedAction:
        row.expectedAction,

      riskLevel:
        row.expectedRiskLevel,

      requiresHumanReview:
        toBoolean(
          row.expectedHumanReview
        ),

      automationAllowed:
        toBoolean(
          row.expectedAutomationAllowed
        ),

      governanceCategory:
        row.expectedGovernanceCategory,

      evidencePresent:
        toBoolean(
          row.expectedEvidencePresent
        ),

      forbiddenRootCause:
        row.forbiddenRootCause || null,

      forbiddenAction:
        row.forbiddenAction || null
    }
  }
};
