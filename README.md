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

## Architecture

The UI is decoupled from the agent backend through a single data-source
adapter, so the same frontend runs against mock data, an n8n workflow,
or a LangGraph agent by changing one environment variable.

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

## Tech stack

**Frontend (in progress)**

- Next.js, React, TypeScript
- Tailwind CSS

**Backends (planned)**

- n8n (webhook-triggered workflow)
- LangGraph

## Status

**Active build.** This repository is at the scaffolding stage; the
application code is not committed yet. Progress is tracked in the commit
history, which follows [Conventional Commits](https://www.conventionalcommits.org/).

- [x] Repository setup
- [ ] Next.js + Tailwind scaffold
- [ ] Mock data and exception queue UI
- [ ] Price variance: detail view and proposal review
- [ ] n8n webhook integration
- [ ] Remaining exception types
- [ ] LangGraph backend

## Data

All invoice, PO, and vendor data in this repository is **synthetic**.
No real company, vendor, or financial data is used or committed.

## Local setup

_Setup instructions will be added once the app is scaffolded._ Runtime
configuration lives in `.env.local`, created from the template:

```bash
cp .env.example .env.local
```

## License

[MIT](LICENSE) © 2026 Mohanraja Sivakumar
