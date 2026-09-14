# Original n8n Code node sources

Verbatim JavaScript from the n8n workflows' Code nodes, extracted by
`scripts/extract-n8n-code-nodes.mjs`. The TypeScript ports in `src/lib`
are tested against these files: the same inputs are run through both, and
the outputs must match (see `*.differential.test.ts`).

| File                                   | n8n workflow            | Node                              | Ported to                                      |
| -------------------------------------- | ----------------------- | --------------------------------- | ---------------------------------------------- |
| `deterministic-matching-engine.js`     | AP Invoice processing   | Deterministic Matching engine     | `src/lib/domain/matching.ts`                   |
| `apply-resolution-risk-policy.js`      | AP Invoice processing   | Apply Resolution Risk Policy      | `src/lib/domain/governance.ts`                 |
| `build-evaluation-transaction.js`      | AP Invoice processing   | Build Evaluation Transaction      | `src/lib/eval/build-evaluation-transaction.ts` |
| `normalize-eval-amendment-response.js` | TOOL - Get PO Amendment | Normalize Eval Amendment Response | `src/lib/eval/normalize-amendment-response.ts` |

The files are excluded from ESLint and Prettier so they stay byte-for-byte
identical to the workflow. They are not valid standalone modules (n8n Code
nodes use a top-level `return` and the `$json` variable); the test harness
in `src/test-utils/n8n-code.ts` runs them the way n8n does for a
"Run Once for Each Item" node.

The workflow exports themselves are not committed: they contain credential
names and IDs and instance, project, workflow and data-table identifiers.

To refresh after changing a node in n8n, export the workflows and run:

```bash
npm run extract:n8n -- "AP Invoice processing.json" "TOOL - Get PO Amendment.json"
```
