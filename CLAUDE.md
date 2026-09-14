@AGENTS.md

# Project context

This repository is a public portfolio demo of the **AP Matching & Exception
Resolution Agent**, whose backend is an n8n workflow.

## Source of truth

`docs/AP_Matching_Exception_Resolution_Agent_Documentation.md` defines the
domain model, contracts and decision logic. Read the relevant sections before
changing the domain model or UI:

- Contracts: sections 9 (transaction), 10 (matching), 13 (PO amendment tool),
  14 (agent output), 15 (governance), 16 (human review), 17 (audit), and
  Appendix A (data contracts) and B (decision logic).
- Evaluation: sections 18–22 and Appendix C. Release gates are in 21.5;
  False Auto Resolution (21.4) is the safety gate and must be 0.
- Security: section 24. The LLM is not an authorization boundary; nothing in
  the UI or docs may imply that it is.
- Demo order: section 31. UI navigation follows this walkthrough.
- Future direction (seams only, not built): sections 27 and 28.

Precedence when sources disagree:

1. The extracted n8n artifacts in `n8n/` (actual node code and output schema).
   The app follows n8n node output shapes where the document differs, e.g.
   the audit record in section 17.2.
2. The documentation.
3. Earlier conversational decisions.

Flag conflicts to the user rather than silently choosing.

## Rules that are easy to get wrong

- Ports of n8n Code nodes are verified by differential tests against
  `n8n/code-nodes/`. Keep them passing; document any intentional divergence
  (see `docs/n8n-float-tolerance-bug.md`).
- The mock agent returns expected answers. Never present mock-agent output as
  a model quality result; evaluation metrics come only from an imported n8n
  evaluation run export.
- The current governance policy trusts the agent's asserted root cause; the
  fix is deterministic evidence validation. Say so where governance is shown.
- All data is synthetic. Never commit real supplier, buyer or invoice data,
  n8n workflow exports, or credential/instance identifiers.
- Conventional Commits, one commit per milestone step, each passing
  format, lint, typecheck, tests (and build for app changes).
