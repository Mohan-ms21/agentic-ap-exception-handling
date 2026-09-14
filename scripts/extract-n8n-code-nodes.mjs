// Extracts the jsCode of selected n8n Code nodes (into n8n/code-nodes/) and
// the JSON Schema of the agent's structured output parser (into
// n8n/schemas/) from workflow exports, for tests against the TypeScript
// ports.
//
// Usage:
//   npm run extract:n8n -- <AP Invoice processing.json> <TOOL - Get PO Amendment.json> <AP Batch Intake.json>
//
// Only node source and the output schema are written. Workflow
// exports stay out of the repo: they contain credential names and IDs,
// instance, project, workflow and data-table identifiers. As a safeguard,
// extraction fails if any such identifier appears in the extracted code.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const NODES = [
  {
    workflow: "AP Invoice processing",
    node: "Deterministic Matching engine",
    file: "deterministic-matching-engine.js",
  },
  {
    workflow: "AP Invoice processing",
    node: "Apply Resolution Risk Policy",
    file: "apply-resolution-risk-policy.js",
  },
  {
    workflow: "AP Invoice processing",
    node: "Calculate Evaluation Metrics",
    file: "calculate-evaluation-metrics.js",
  },
  {
    workflow: "AP Invoice processing",
    node: "Build Evaluation Transaction",
    file: "build-evaluation-transaction.js",
  },
  {
    workflow: "AP Batch Intake",
    node: "Build Invoice Processing Input",
    file: "build-invoice-processing-input.js",
  },
  {
    workflow: "TOOL - Get PO Amendment",
    node: "Lookup PO Amendment",
    file: "lookup-po-amendment.js",
  },
  {
    workflow: "TOOL - Get PO Amendment",
    node: "Normalize Eval Amendment Response",
    file: "normalize-eval-amendment-response.js",
  },
];

// Identifiers in the export, recognised by shape rather than by key (keys
// like "id" also hold ordinary column names): UUIDs, n8n's 16-character
// resource IDs, 64-hex instance IDs, resource URLs, and credential names.
const ID_SHAPES = [
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])[A-Za-z0-9]{16}$/,
  /^[0-9a-f]{64}$/,
  /^\/(projects|workflow)\//,
];

function collectIdentifiers(value, found = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectIdentifiers(item, found));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "jsCode") continue;
      if (k === "credentials" && v && typeof v === "object") {
        for (const credential of Object.values(v)) {
          if (credential?.id) found.add(credential.id);
          if (credential?.name) found.add(credential.name);
        }
      }
      collectIdentifiers(v, found);
    }
  } else if (
    typeof value === "string" &&
    ID_SHAPES.some((re) => re.test(value))
  ) {
    found.add(value);
  }
  return found;
}

const SCHEMAS = [
  {
    workflow: "AP Invoice processing",
    node: "Exception Resolution Output Schema",
    file: "exception-resolution-output-schema.json",
  },
];

function assertNoIdentifiers(text, workflow, label) {
  const leaked = [...collectIdentifiers(workflow)].filter((id) =>
    text.includes(id),
  );
  if (leaked.length > 0) {
    throw new Error(
      `"${label}" contains workflow identifiers: ${leaked.join(", ")}`,
    );
  }
}

const exports = process.argv
  .slice(2)
  .map((path) => JSON.parse(readFileSync(path, "utf8")));
if (exports.length === 0) {
  console.error("Pass the workflow export JSON files as arguments.");
  process.exit(1);
}

for (const spec of NODES) {
  const workflow = exports.find((w) => w.name === spec.workflow);
  if (!workflow)
    throw new Error(`Workflow "${spec.workflow}" not among the inputs`);
  const node = workflow.nodes.find((n) => n.name === spec.node);
  const code = node?.parameters?.jsCode;
  if (typeof code !== "string") {
    throw new Error(`Code node "${spec.node}" not found in "${spec.workflow}"`);
  }

  assertNoIdentifiers(code, workflow, spec.node);

  const header =
    `// Extracted verbatim from the n8n Code node "${spec.node}"\n` +
    `// (workflow "${spec.workflow}") by scripts/extract-n8n-code-nodes.mjs.\n` +
    `// Do not edit: re-run the extraction instead.\n\n`;
  writeFileSync(join(root, "n8n/code-nodes", spec.file), header + code + "\n");
  console.log(`Wrote n8n/code-nodes/${spec.file}`);
}

for (const spec of SCHEMAS) {
  const workflow = exports.find((w) => w.name === spec.workflow);
  if (!workflow)
    throw new Error(`Workflow "${spec.workflow}" not among the inputs`);
  const node = workflow.nodes.find((n) => n.name === spec.node);
  const schema = node?.parameters?.inputSchema;
  if (typeof schema !== "string") {
    throw new Error(
      `Output parser "${spec.node}" not found in "${spec.workflow}"`,
    );
  }
  assertNoIdentifiers(schema, workflow, spec.node);
  // Re-serialize so the file is stable JSON; the content is unchanged.
  const json = JSON.stringify(JSON.parse(schema), null, 2);
  writeFileSync(join(root, "n8n/schemas", spec.file), json + "\n");
  console.log(`Wrote n8n/schemas/${spec.file}`);
}
