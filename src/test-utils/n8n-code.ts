import { readFileSync } from "node:fs";
import { join } from "node:path";

const CODE_NODE_DIR = join(__dirname, "../../n8n/code-nodes");
const PROPOSED_DIR = join(__dirname, "../../n8n/proposed");

export type N8nCodeNode =
  | "deterministic-matching-engine"
  | "apply-resolution-risk-policy"
  | "calculate-evaluation-metrics"
  | "build-evaluation-transaction"
  | "build-invoice-processing-input"
  | "lookup-po-amendment"
  | "normalize-eval-amendment-response";

/**
 * Loads an original n8n Code node and returns a function that runs it the
 * way n8n runs a "Run Once for Each Item" node: `$json` is the item and the
 * top-level `return` value is the output. n8n accepts either `{ json }` or a
 * bare object as the return value; both are unwrapped to the item JSON.
 *
 * Test-only: executes source from the repository, never user input.
 */
/** Code proposed for n8n but not yet applied there (n8n/proposed). */
export type ProposedN8nCodeNode = "apply-resolution-risk-policy-hardened";

export function loadProposedN8nCodeNode(name: ProposedN8nCodeNode) {
  return runnable(readFileSync(join(PROPOSED_DIR, `${name}.js`), "utf8"));
}

export function loadN8nCodeNode(name: N8nCodeNode) {
  const source = readFileSync(join(CODE_NODE_DIR, `${name}.js`), "utf8");
  return runnable(source);
}

/** As loadN8nCodeNode, for a patched copy of a node's source. */
export function loadPatchedN8nCodeNode(
  name: N8nCodeNode,
  patch: (source: string) => string,
) {
  const source = readFileSync(join(CODE_NODE_DIR, `${name}.js`), "utf8");
  const patched = patch(source);
  if (patched === source) {
    throw new Error(`Patch did not change ${name}.js`);
  }
  return runnable(patched);
}

function runnable(source: string) {
  const fn = new Function("$json", source) as (json: unknown) => unknown;
  return (json: unknown): Record<string, unknown> => {
    const result = fn(structuredClone(json)) as Record<string, unknown>;
    return "json" in result && Object.keys(result).length === 1
      ? (result.json as Record<string, unknown>)
      : result;
  };
}
