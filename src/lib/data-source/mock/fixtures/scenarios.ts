import type { AgentProposal, ReviewDecision } from "@/lib/domain/schemas";
import {
  addSeconds,
  buildDocuments,
  MOCK_AGENT,
  usd,
  type Documents,
} from "./builders";
import {
  apReviewer,
  facilitiesBuyer,
  labBuyer,
  packagingBuyer,
  quillfeather,
  tallowmere,
  veloren,
} from "./vendors";

// Synthetic price-variance scenarios. Each exercises a different resolution
// path. Variance figures are not stored here: the mock data source computes
// them from these documents with the real tolerance logic.

export type MockCase = {
  exceptionId: string;
  invoiceId: string;
  detectedAt: string;
  proposal: AgentProposal | null;
  decision: ReviewDecision | null;
};

export type Scenario = { documents: Documents; mockCase: MockCase };

function proposal(
  exceptionId: string,
  detectedAt: string,
  fields: Pick<
    AgentProposal,
    "action" | "rationale" | "evidence" | "confidence"
  >,
): AgentProposal {
  return {
    id: exceptionId.replace("exc-", "prop-"),
    exceptionId,
    proposedAt: addSeconds(detectedAt, 95),
    producedBy: MOCK_AGENT,
    ...fields,
  };
}

// 1. Vendor price list moved up after the PO was raised; PO never amended.
const s1Detected = "2026-08-07T14:12:00Z";
const scenario1: Scenario = {
  documents: buildDocuments({
    vendor: quillfeather,
    buyer: facilitiesBuyer,
    po: { number: "PO-4500101", orderDate: "2026-06-20" },
    receipt: { number: "GR-5000101", receivedDate: "2026-08-04" },
    invoice: {
      id: "inv-88213",
      number: "QIS-88213",
      invoiceDate: "2026-08-05",
      receivedDate: "2026-08-07",
      taxRateBps: 725,
    },
    lines: [
      {
        itemCode: "HB-M10-100",
        description: "Hex bolt M10 x 50 mm, zinc plated, box of 100",
        quantity: 40,
        unitOfMeasure: "BOX",
        poPrice: "18.50",
        invoicePrice: "19.25",
      },
    ],
  }),
  mockCase: {
    exceptionId: "exc-1001",
    invoiceId: "inv-88213",
    detectedAt: s1Detected,
    proposal: proposal("exc-1001", s1Detected, {
      action: {
        type: "route_to_buyer",
        reason:
          "Amend PO-4500101 line 1 to the current list price of $19.25 before the invoice is approved.",
      },
      rationale:
        "The invoiced price matches the vendor's price list effective 2026-07-01. The PO was raised on 2026-06-20, before that change, and was never amended. The variance reflects a stale PO rather than an overbilling, so the fix belongs with the buyer.",
      evidence: [
        {
          kind: "po_line",
          reference: "PO-4500101 line 1",
          summary: "$18.50 per box; PO dated 2026-06-20.",
        },
        {
          kind: "invoice_line",
          reference: "QIS-88213 line 1",
          summary: "$19.25 per box for 40 boxes.",
        },
        {
          kind: "vendor_price_list",
          reference: "Quillfeather price list 2026-Q3, item HB-M10-100",
          summary: "$19.25 effective 2026-07-01, up from $18.50.",
        },
        {
          kind: "goods_receipt",
          reference: "GR-5000101",
          summary: "40 boxes received on 2026-08-04; quantity matches.",
        },
      ],
      confidence: "high",
    }),
    decision: null,
  },
};

// 2. Overbilled against a fixed contract price; no supporting evidence.
const s2Detected = "2026-08-12T09:05:00Z";
const scenario2: Scenario = {
  documents: buildDocuments({
    vendor: tallowmere,
    buyer: packagingBuyer,
    po: { number: "PO-4500102", orderDate: "2026-07-02" },
    receipt: { number: "GR-5000102", receivedDate: "2026-08-10" },
    invoice: {
      id: "inv-04417",
      number: "TPC-2026-04417",
      invoiceDate: "2026-08-11",
      receivedDate: "2026-08-12",
      taxRateBps: 725,
    },
    lines: [
      {
        itemCode: "CB-181818-DW",
        description: "Corrugated box 18 x 18 x 18 in, double wall",
        quantity: 500,
        unitOfMeasure: "EA",
        poPrice: "2.40",
        invoicePrice: "2.95",
      },
    ],
  }),
  mockCase: {
    exceptionId: "exc-1002",
    invoiceId: "inv-04417",
    detectedAt: s2Detected,
    proposal: proposal("exc-1002", s2Detected, {
      action: { type: "request_credit_note", amount: usd("275.00") },
      rationale:
        "The supply agreement fixes this item at $2.40 through 2026-12-31, and no amendment or price notice is on file. The $0.55 per-unit difference across 500 units is an overbilling of $275.00.",
      evidence: [
        {
          kind: "contract",
          reference: "Supply agreement SA-2025-031, schedule A",
          summary: "$2.40 per unit, fixed through 2026-12-31.",
        },
        {
          kind: "po_line",
          reference: "PO-4500102 line 1",
          summary: "$2.40 per unit for 500 units.",
        },
        {
          kind: "invoice_line",
          reference: "TPC-2026-04417 line 1",
          summary: "$2.95 per unit for 500 units.",
        },
      ],
      confidence: "high",
    }),
    decision: null,
  },
};

// 3. Multi-line invoice; only one line is out of tolerance.
const s3Detected = "2026-08-14T16:40:00Z";
const scenario3: Scenario = {
  documents: buildDocuments({
    vendor: veloren,
    buyer: labBuyer,
    po: { number: "PO-4500103", orderDate: "2026-07-08" },
    receipt: { number: "GR-5000103", receivedDate: "2026-08-13" },
    invoice: {
      id: "inv-30982",
      number: "VLC-INV-30982",
      invoiceDate: "2026-08-14",
      receivedDate: "2026-08-14",
      taxRateBps: 0,
    },
    lines: [
      {
        itemCode: "NG-M-100",
        description: "Nitrile gloves, medium, box of 100",
        quantity: 60,
        unitOfMeasure: "BOX",
        poPrice: "11.00",
        invoicePrice: "11.00",
      },
      {
        itemCode: "PT-200-96",
        description: "Pipette tips 200 uL, rack of 96",
        quantity: 120,
        unitOfMeasure: "RACK",
        poPrice: "6.80",
        invoicePrice: "7.60",
      },
      {
        itemCode: "SV-2ML-50",
        description: "Screw-cap sample vials 2 mL, pack of 50",
        quantity: 30,
        unitOfMeasure: "PACK",
        poPrice: "24.00",
        invoicePrice: "24.00",
      },
    ],
  }),
  mockCase: {
    exceptionId: "exc-1003",
    invoiceId: "inv-30982",
    detectedAt: s3Detected,
    proposal: proposal("exc-1003", s3Detected, {
      action: { type: "request_credit_note", amount: usd("96.00") },
      rationale:
        "Lines 1 and 3 match the PO. Line 2 is billed at $7.60 against an agreed $6.80, an overbilling of $96.00 across 120 racks. Request a credit note for line 2 only; the rest of the invoice can proceed.",
      evidence: [
        {
          kind: "po_line",
          reference: "PO-4500103 line 2",
          summary: "$6.80 per rack for 120 racks.",
        },
        {
          kind: "invoice_line",
          reference: "VLC-INV-30982 line 2",
          summary: "$7.60 per rack for 120 racks.",
        },
        {
          kind: "contract",
          reference: "Catalog price agreement CPA-118",
          summary:
            "Pipette tips PT-200-96 at $6.80 per rack through 2027-03-31.",
        },
      ],
      confidence: "high",
    }),
    decision: null,
  },
};

// 4. Every line within tolerance, but the invoice total breaches $250.
const s4Detected = "2026-08-20T11:22:00Z";
const scenario4: Scenario = {
  documents: buildDocuments({
    vendor: quillfeather,
    buyer: facilitiesBuyer,
    po: { number: "PO-4500104", orderDate: "2026-07-14" },
    receipt: { number: "GR-5000104", receivedDate: "2026-08-18" },
    invoice: {
      id: "inv-88790",
      number: "QIS-88790",
      invoiceDate: "2026-08-19",
      receivedDate: "2026-08-20",
      taxRateBps: 725,
    },
    lines: [
      {
        itemCode: "DRL-18V-BT",
        description: "Cordless drill 18 V, bare tool",
        quantity: 30,
        unitOfMeasure: "EA",
        poPrice: "100.00",
        invoicePrice: "101.50",
      },
      {
        itemCode: "TCB-5D",
        description: "Rolling tool cabinet, 5 drawer",
        quantity: 12,
        unitOfMeasure: "EA",
        poPrice: "250.00",
        invoicePrice: "254.00",
      },
      {
        itemCode: "SHN-FB",
        description: "Safety harness, full body",
        quantity: 35,
        unitOfMeasure: "EA",
        poPrice: "80.00",
        invoicePrice: "81.20",
      },
      {
        itemCode: "HYD-46-5G",
        description: "Hydraulic oil ISO 46, 5 gal pail",
        quantity: 50,
        unitOfMeasure: "EA",
        poPrice: "45.00",
        invoicePrice: "45.80",
      },
      {
        itemCode: "LHB-150W",
        description: "LED high-bay light 150 W",
        quantity: 20,
        unitOfMeasure: "EA",
        poPrice: "150.00",
        invoicePrice: "152.25",
      },
      {
        itemCode: "WSU-48",
        description: "Wire shelving unit 48 in",
        quantity: 45,
        unitOfMeasure: "EA",
        poPrice: "60.00",
        invoicePrice: "61.00",
      },
    ],
  }),
  mockCase: {
    exceptionId: "exc-1004",
    invoiceId: "inv-88790",
    detectedAt: s4Detected,
    proposal: proposal("exc-1004", s4Detected, {
      action: {
        type: "hold_for_investigation",
        reason:
          "Confirm with the vendor whether a price increase or surcharge was applied before paying.",
      },
      rationale:
        "No single line breaches tolerance, but all six are 1.5-1.8% above the PO, adding up to $265.00. A uniform uplift across unrelated items suggests an unannounced increase or surcharge rather than six independent errors. The vendor's current price list shows no change for these items, so there is nothing to justify approving it yet.",
      evidence: [
        {
          kind: "invoice_line",
          reference: "QIS-88790 lines 1-6",
          summary: "Each line priced 1.5-1.8% above the PO.",
        },
        {
          kind: "po_line",
          reference: "PO-4500104 lines 1-6",
          summary: "Prices agreed on 2026-07-14.",
        },
        {
          kind: "vendor_price_list",
          reference: "Quillfeather price list 2026-Q3",
          summary: "No changes listed for any of the six items.",
        },
      ],
      confidence: "medium",
    }),
    decision: null,
  },
};

// 5. Large favorable variance: likely a pricing error or substituted product.
const s5Detected = "2026-08-26T08:47:00Z";
const scenario5: Scenario = {
  documents: buildDocuments({
    vendor: tallowmere,
    buyer: packagingBuyer,
    po: { number: "PO-4500105", orderDate: "2026-07-20" },
    receipt: { number: "GR-5000105", receivedDate: "2026-08-24" },
    invoice: {
      id: "inv-04562",
      number: "TPC-2026-04562",
      invoiceDate: "2026-08-25",
      receivedDate: "2026-08-26",
      taxRateBps: 725,
    },
    lines: [
      {
        itemCode: "SW-18-1500-80G",
        description: "Stretch wrap 18 in x 1500 ft, 80 gauge",
        quantity: 200,
        unitOfMeasure: "ROLL",
        poPrice: "32.00",
        invoicePrice: "22.40",
      },
    ],
  }),
  mockCase: {
    exceptionId: "exc-1005",
    invoiceId: "inv-04562",
    detectedAt: s5Detected,
    proposal: proposal("exc-1005", s5Detected, {
      action: {
        type: "route_to_buyer",
        reason:
          "Confirm with the vendor whether 80 gauge wrap was delivered and billed at the wrong price, or 60 gauge was substituted.",
      },
      rationale:
        "The invoice is 30% below the PO. $22.40 is the agreement price for 60 gauge wrap, not the 80 gauge ordered, so either the vendor billed the wrong item or delivered a substitute. Paying as invoiced risks a later re-bill or accepting a product that does not meet spec.",
      evidence: [
        {
          kind: "contract",
          reference: "Supply agreement SA-2025-031, schedule A",
          summary:
            "$32.00 per roll for 80 gauge; $22.40 per roll for 60 gauge.",
        },
        {
          kind: "invoice_line",
          reference: "TPC-2026-04562 line 1",
          summary: "$22.40 per roll for 200 rolls, described as 80 gauge.",
        },
        {
          kind: "goods_receipt",
          reference: "GR-5000105",
          summary: "200 rolls received; the receipt does not record gauge.",
        },
      ],
      confidence: "medium",
    }),
    decision: null,
  },
};

// 6. Conflicting evidence: the agent flags the conflict instead of guessing.
const s6Detected = "2026-08-31T13:30:00Z";
const scenario6: Scenario = {
  documents: buildDocuments({
    vendor: veloren,
    buyer: labBuyer,
    po: { number: "PO-4500106", orderDate: "2026-07-27" },
    receipt: { number: "GR-5000106", receivedDate: "2026-08-27" },
    invoice: {
      id: "inv-31406",
      number: "VLC-INV-31406",
      invoiceDate: "2026-08-28",
      receivedDate: "2026-08-31",
      taxRateBps: 0,
    },
    lines: [
      {
        itemCode: "CT-50-500",
        description: "Centrifuge tubes 50 mL, sterile, case of 500",
        quantity: 25,
        unitOfMeasure: "CASE",
        poPrice: "84.00",
        invoicePrice: "92.00",
      },
    ],
  }),
  mockCase: {
    exceptionId: "exc-1006",
    invoiceId: "inv-31406",
    detectedAt: s6Detected,
    proposal: proposal("exc-1006", s6Detected, {
      action: {
        type: "hold_for_investigation",
        reason:
          "Ask the buyer which price was agreed: the $92.00 quote or the $84.00 price agreement.",
      },
      rationale:
        "The evidence conflicts. A vendor quote supports $92.00, but it predates the PO, and both the PO and the price agreement say $84.00. It is unclear whether the quote was meant to supersede the agreement. There is not enough evidence to recommend paying or disputing the $200.00 difference.",
      evidence: [
        {
          kind: "quote",
          reference: "Veloren quote Q-VLC-2291, dated 2026-07-15",
          summary: "$92.00 per case, valid for 30 days.",
        },
        {
          kind: "contract",
          reference: "Catalog price agreement CPA-118",
          summary: "$84.00 per case through 2027-03-31.",
        },
        {
          kind: "po_line",
          reference: "PO-4500106 line 1",
          summary: "$84.00 per case; raised 2026-07-27, after the quote.",
        },
      ],
      confidence: "low",
    }),
    decision: null,
  },
};

// 7. Already resolved: a reviewer approved the credit note request.
const s7Detected = "2026-07-30T10:15:00Z";
const scenario7: Scenario = {
  documents: buildDocuments({
    vendor: quillfeather,
    buyer: facilitiesBuyer,
    po: { number: "PO-4500107", orderDate: "2026-06-30" },
    receipt: { number: "GR-5000107", receivedDate: "2026-07-28" },
    invoice: {
      id: "inv-87954",
      number: "QIS-87954",
      invoiceDate: "2026-07-29",
      receivedDate: "2026-07-30",
      taxRateBps: 725,
    },
    lines: [
      {
        itemCode: "SG-Z87-CLR",
        description: "Safety glasses, clear lens, ANSI Z87.1",
        quantity: 150,
        unitOfMeasure: "EA",
        poPrice: "6.20",
        invoicePrice: "6.90",
      },
    ],
  }),
  mockCase: {
    exceptionId: "exc-1007",
    invoiceId: "inv-87954",
    detectedAt: s7Detected,
    proposal: proposal("exc-1007", s7Detected, {
      action: { type: "request_credit_note", amount: usd("105.00") },
      rationale:
        "The PO and the vendor's price list both show $6.20. The invoice bills $6.90 with no price notice on file, an overbilling of $105.00 across 150 units.",
      evidence: [
        {
          kind: "po_line",
          reference: "PO-4500107 line 1",
          summary: "$6.20 per unit for 150 units.",
        },
        {
          kind: "invoice_line",
          reference: "QIS-87954 line 1",
          summary: "$6.90 per unit for 150 units.",
        },
        {
          kind: "vendor_price_list",
          reference: "Quillfeather price list 2026-Q3, item SG-Z87-CLR",
          summary: "$6.20, unchanged since 2026-Q1.",
        },
      ],
      confidence: "high",
    }),
    decision: {
      outcome: "approved",
      finalAction: { type: "request_credit_note", amount: usd("105.00") },
      comment: "Vendor contacted; credit note requested.",
      reviewer: apReviewer,
      decidedAt: "2026-07-31T15:02:00Z",
    },
  },
};

// 8. Just detected: the agent has not produced a proposal yet.
const scenario8: Scenario = {
  documents: buildDocuments({
    vendor: tallowmere,
    buyer: packagingBuyer,
    po: { number: "PO-4500108", orderDate: "2026-08-10" },
    receipt: { number: "GR-5000108", receivedDate: "2026-09-08" },
    invoice: {
      id: "inv-04801",
      number: "TPC-2026-04801",
      invoiceDate: "2026-09-09",
      receivedDate: "2026-09-10",
      taxRateBps: 725,
    },
    lines: [
      {
        itemCode: "PT-48-110-CLR",
        description: "Packing tape 48 mm x 110 m, clear",
        quantity: 300,
        unitOfMeasure: "ROLL",
        poPrice: "3.10",
        invoicePrice: "3.45",
      },
    ],
  }),
  mockCase: {
    exceptionId: "exc-1008",
    invoiceId: "inv-04801",
    detectedAt: "2026-09-10T15:55:00Z",
    proposal: null,
    decision: null,
  },
};

export const scenarios: Scenario[] = [
  scenario1,
  scenario2,
  scenario3,
  scenario4,
  scenario5,
  scenario6,
  scenario7,
  scenario8,
];
