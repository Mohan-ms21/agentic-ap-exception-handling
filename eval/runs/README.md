# Evaluation run exports

Exports of the n8n evaluation data table after an evaluation run, with the
`actual*` and metric columns filled. The evaluation view shows each run
here; none has been imported yet.

| File           | Run      | Policy                                                                             |
| -------------- | -------- | ---------------------------------------------------------------------------------- |
| `baseline.csv` | Baseline | Current Apply Resolution Risk Policy, which trusts the agent's asserted root cause |
| `hardened.csv` | Hardened | Policy with deterministic evidence validation (independent PO amendment lookup)    |

Add or replace a file, then run `npm run generate:data`. The app:

- reads only the `actual*` columns and `evaluationRunAt` from the export;
  inputs and expected outcomes come from the dataset in `eval/`, and an
  export whose cases or input columns differ from it is reported as
  mismatched rather than used;
- recomputes every metric with the ported Calculate Evaluation Metrics node
  and flags stored metric columns that disagree.
