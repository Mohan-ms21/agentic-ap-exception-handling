# n8n workflow artifacts

Pieces of the n8n workflows that the TypeScript ports in `src/lib` are
tested against, extracted by `scripts/extract-n8n-code-nodes.mjs`.

## Code nodes (`code-nodes/`)

Verbatim JavaScript from the workflows' Code nodes. The same inputs are run
through the original node and the port, and the outputs must match (see
`*.differential.test.ts`).

| File                                   | n8n workflow            | Node                              | Ported to                                         |
| -------------------------------------- | ----------------------- | --------------------------------- | ------------------------------------------------- |
| `deterministic-matching-engine.js`     | AP Invoice processing   | Deterministic Matching engine     | `src/lib/domain/matching.ts`                      |
| `apply-resolution-risk-policy.js`      | AP Invoice processing   | Apply Resolution Risk Policy      | `src/lib/domain/governance.ts`                    |
| `calculate-evaluation-metrics.js`      | AP Invoice processing   | Calculate Evaluation Metrics      | `src/lib/eval/metrics.ts`                         |
| `build-evaluation-transaction.js`      | AP Invoice processing   | Build Evaluation Transaction      | `src/lib/eval/build-evaluation-transaction.ts`    |
| `build-invoice-processing-input.js`    | AP Batch Intake         | Build Invoice Processing Input    | `src/lib/batch/build-invoice-processing-input.ts` |
| `lookup-po-amendment.js`               | TOOL - Get PO Amendment | Lookup PO Amendment               | `src/lib/data-source/mock/lookup-po-amendment.ts` |
| `normalize-eval-amendment-response.js` | TOOL - Get PO Amendment | Normalize Eval Amendment Response | `src/lib/eval/normalize-amendment-response.ts`    |

These files are excluded from ESLint and Prettier so they stay byte-for-byte
identical to the workflow. They are not valid standalone modules (n8n Code
nodes use a top-level `return` and the `$json` variable); the test harness
in `src/test-utils/n8n-code.ts` runs them the way n8n runs a "Run Once for
Each Item" node.

## Schemas (`schemas/`)

| File                                      | n8n workflow          | Node                               | Mirrored by                                             |
| ----------------------------------------- | --------------------- | ---------------------------------- | ------------------------------------------------------- |
| `exception-resolution-output-schema.json` | AP Invoice processing | Exception Resolution Output Schema | `agentDecisionSchema` in `src/lib/domain/resolution.ts` |

A test converts the Zod schema to JSON Schema and requires it to equal
this file.

## Proposed changes (`proposed/`)

Code written for the workflow but not yet applied in n8n, ported and tested
here so the change can be shown. See [`proposed/README.md`](proposed/README.md).

## What is not here

The workflow exports themselves: they contain credential names and IDs and
instance, project, workflow and data-table identifiers. Extraction fails if
any such identifier appears in an extracted file.

To refresh after changing a node in n8n, export the workflows and run:

```bash
npm run extract:n8n -- "AP Invoice processing.json" "TOOL - Get PO Amendment.json" "AP Batch Intake.json"
```
