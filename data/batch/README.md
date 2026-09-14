# Batch intake demo data

`ap_batch_intake_demo_v2.csv` is an export of the n8n **AP Batch Intake Demo**
data table used by the **AP Batch Intake** workflow. Each row becomes one
invoice processing input (and one child workflow execution); see section 8 of
the [solution documentation](../../docs/AP_Matching_Exception_Resolution_Agent_Documentation.md).

The app's queue uses `BATCH-DEMO-001`, the six invoices from the demo
walkthrough (section 31.2):

| Invoice  | Expected matching result (section 7.3) |
| -------- | -------------------------------------- |
| INV-3001 | MATCHED                                |
| INV-3002 | PRICE_VARIANCE                         |
| INV-3003 | QUANTITY_VARIANCE                      |
| INV-3004 | MISSING_RECEIPT                        |
| INV-3005 | CURRENCY_MISMATCH                      |
| INV-3006 | PO_NOT_FOUND                           |

`BATCH-DEMO-002` (two further invoices) is kept as exported but not shown.

All data is synthetic.

## Changes from the n8n export

Supplier and buyer names were replaced with demo names, and the
invoice-number prefix derived from the supplier name with `DEMO-`, so that no
real company or person names appear. All other values are unchanged.

## Updating

Replace the CSV, then run `npm run generate:data`. The drift test in
`src/lib/batch/batch-intake.test.ts` fails until the generated module agrees.
