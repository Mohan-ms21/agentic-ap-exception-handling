# Agentic AP Exception Handling

A demo web app for an agentic accounts-payable (AP) system that triages
invoice exceptions — invoices that fail automated matching against the
purchase order (PO) and goods receipt — and proposes a resolution for a
human to approve.

> **Live demo:** _coming soon_
>
> **Screenshots:** _coming soon_

## What it does

In most AP teams, invoices that fail matching land in a queue where a
clerk investigates each one by hand: pull the PO, compare lines, check
tolerances, decide whether to approve, request a credit note, or route
to a buyer. This project models that workflow with an agent doing the
investigation and a human keeping the decision.

For each exception, the system:

1. **Classifies** the exception type.
2. **Gathers context** — invoice lines, PO lines, receipts, vendor terms.
3. **Proposes a resolution** with its reasoning and the evidence behind it.
4. **Waits for a human** to approve, edit, or reject the proposal.
   Nothing is posted or paid without explicit approval.

### Exception coverage

| Exception type         | Status                                 |
| ---------------------- | -------------------------------------- |
| Price variance         | In scope — first type built end to end |
| Quantity variance      | Planned                                |
| Missing / closed PO    | Planned                                |
| Duplicate suspicion    | Planned                                |
| Vendor master mismatch | Planned                                |
| Tax discrepancy        | Planned                                |

Price variance is deliberately the only exception type being built for
now. The others are scoped but not implemented.

### Price variance tolerance

An invoice raises a price-variance exception when:

- a line's unit price differs from the PO by **more than 2%**, or
- a line's extended variance (unit difference x quantity) is **more
  than $50**, or
- the sum of absolute line variances on the invoice is **more than
  $250**, even if every line is individually within tolerance.

Limits are exclusive (exactly 2% is within tolerance) and apply to
favorable variances as well, since an invoice far below the PO usually
signals a pricing error or a substituted product. Absolute values are
summed so that over- and under-billing on different lines cannot cancel
each other out.

## Architecture

The UI is decoupled from the agent backend through a single data-source
adapter, so the same frontend runs against mock data, an n8n workflow,
or a LangGraph agent by changing one server-side environment variable,
`DATA_SOURCE`.

```
┌──────────────────────────────────┐
│ Next.js UI (React + Tailwind)    │
│ queue, detail, approve/reject    │
└────────────────┬─────────────────┘
                 │
┌────────────────▼─────────────────┐
│ Data-source adapter (server)     │
│ mock | n8n | langgraph           │
└────┬───────────┬───────────┬─────┘
     │           │           │
┌────▼────┐ ┌────▼────┐ ┌────▼────┐
│  Mock   │ │   n8n   │ │LangGraph│
│  data   │ │ webhook │ │  agent  │
│ (now)   │ │ (next)  │ │ (later) │
└─────────┘ └─────────┘ └─────────┘
```

- **Mock data** — synthetic invoices, POs, and vendors. Lets the UI and
  the human-review flow be built and demoed without a backend.
- **n8n** — the first real backend: a webhook-triggered workflow that
  runs the classification and resolution steps.
- **LangGraph** — a later backend with the same contract, for more
  explicit agent state, branching, and human-in-the-loop checkpoints.

Keeping one contract across all three is the point: it makes the
backends directly comparable and keeps the UI stable while they change.

**How the data layer is built**

- **One domain model.** Zod schemas in `src/lib/domain` define vendors,
  POs, goods receipts, invoices, exceptions, agent proposals, review
  decisions and audit events. TypeScript types are inferred from them,
  and the same schemas validate data arriving from a backend.
- **Deterministic variance logic.** Tolerance checks are plain, unit-tested
  functions, not agent output. The agent's job is to explain a variance
  and propose what to do about it, not to decide whether one exists.
- **Human decisions are constrained.** An approval must take the proposed
  action; an edit must change it and include a comment; a rejection
  requires a comment and escalates the exception. Every step is written
  to an audit trail.
- **Server-only access.** The adapter is marked `server-only`, so a build
  fails if it is imported into browser code, and an invalid `DATA_SOURCE`
  is reported when the server starts.

## Tech stack

**In use**

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4
- Zod 4 for schemas and runtime validation
- Vitest for unit tests
- ESLint and Prettier (with Tailwind class sorting)
- GitHub Actions CI: format, lint, typecheck, test and build on every
  push and pull request
- Node.js 24 LTS

**Backends (planned)**

- n8n (webhook-triggered workflow)
- LangGraph

## Status

**Active build.** The data layer for price variance is in place: domain
model, tolerance logic, the data-source contract and a mock
implementation over synthetic data, all unit-tested. The UI does not use
it yet; the exception queue page still shows an empty state. Progress is
tracked in the commit history, which follows
[Conventional Commits](https://www.conventionalcommits.org/).

- [x] Repository setup
- [x] Next.js + Tailwind scaffold
- [x] Domain model, price variance logic and mock data source
- [ ] Exception queue UI on mock data
- [ ] Price variance: detail view and proposal review
- [ ] n8n webhook integration
- [ ] Remaining exception types
- [ ] LangGraph backend

## Data

All invoice, PO, and vendor data in this repository is **synthetic**.
No real company, vendor, or financial data is used or committed.

The mock dataset (`src/lib/data-source/mock/fixtures`) contains eight
price-variance cases across three fictional vendors, each chosen to
exercise a different path: a PO left stale after a vendor price change,
overbilling against a contract price, one bad line on a multi-line
invoice, small variances that add up past the invoice limit, a large
favorable variance, conflicting evidence where the agent reports low
confidence instead of guessing, a case already resolved by a reviewer,
and one still waiting for the agent. Only source documents are stored;
amounts, totals and variances are computed, so the numbers cannot drift
from the documents.

### Known limitations

- Mock state is held in server memory: decisions reset on restart and
  are not shared across serverless instances.
- Money is stored in integer minor units, so sub-cent unit prices are
  not supported.
- Each invoice, PO and tolerance policy must share one currency; there is
  no currency conversion. The mock data is USD only.
- There is no authentication yet, so the reviewer on a decision is taken
  from the request rather than a session. The decision time is set by
  the server.

## Local setup

Requires Node.js 24 (see `.nvmrc`).

```bash
npm ci
npm run dev
```

Then open http://localhost:3000.

| Script                 | What it does                         |
| ---------------------- | ------------------------------------ |
| `npm run dev`          | Start the dev server                 |
| `npm run build`        | Production build                     |
| `npm run lint`         | ESLint                               |
| `npm run typecheck`    | Generate route types, then run `tsc` |
| `npm run format`       | Format with Prettier                 |
| `npm run format:check` | Check formatting without writing     |
| `npm test`             | Run unit tests once                  |
| `npm run test:watch`   | Run unit tests in watch mode         |

No environment variables are required: `DATA_SOURCE` defaults to
`mock`, which is currently the only implemented backend. Configuration
lives in `.env.local`, created from the template:

```bash
cp .env.example .env.local
```

### Project structure

```
src/
  app/                  routes and root layout (App Router)
  components/           UI components
  instrumentation.ts    validates DATA_SOURCE at server startup
  lib/
    domain/             schemas, money helpers, price variance logic
    data-source/
      types.ts          contract every backend implements
      config.ts         DATA_SOURCE resolution
      index.ts          getDataSource() (server-only)
      mock/             in-memory implementation and synthetic fixtures
```

## License

[MIT](LICENSE) © 2026 Mohanraja Sivakumar
