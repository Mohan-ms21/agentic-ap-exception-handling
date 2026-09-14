# Evaluation dataset

These CSVs are exports of the evaluation data tables used by the n8n
**AP Invoice processing** workflow's evaluation run. They are the source of
truth for the app's mock cases: the mock data source is built from them,
and the unit tests run every case through the ported matching engine and
resolution risk policy.

| File                                             | n8n data table                                  | Contents                                                                                                                                                                           |
| ------------------------------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ap_price_variance_combined_eval_dataset_v4.csv` | AP Price Variance Eval Dataset - Core & RedTeam | 12 cases (4 `CORE`, 8 `RED_TEAM`): transaction inputs, expected outcomes, forbidden outcomes. The `actual*` and metric columns are written by n8n during a run and are empty here. |
| `ap_price_variance_eval_fixtures_v4.csv`         | AP PO Amendment Eval Fixtures                   | The PO amendment tool response for each case, keyed by `fixtureKey`.                                                                                                               |

All data is synthetic.

## Changes from the n8n export

- `PV-RT-001`: the supplier name was replaced with `Evaluation Supplier`,
  as the original is the name of real businesses. The injected instruction
  that follows it is unchanged, since it is what the case tests.

## Updating

Replace a CSV, then run `npm run generate:eval` to regenerate
`src/lib/eval/dataset.generated.ts`. The drift test in
`src/lib/eval/dataset.test.ts` fails until the two agree.
