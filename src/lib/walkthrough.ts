// The demo follows the solution documentation's walkthrough (section 31).

export const DOCUMENTATION_URL =
  "https://github.com/Mohan-ms21/agentic-ap-exception-handling/blob/main/docs/AP_Matching_Exception_Resolution_Agent_Documentation.md";

export const REPOSITORY_URL =
  "https://github.com/Mohan-ms21/agentic-ap-exception-handling";

/** The price-variance invoice the walkthrough opens (section 31.3). */
export const WALKTHROUGH_INVOICE_ID = "INV-3002";

export type WalkthroughStep = {
  slug: string;
  title: string;
  /** Section of the solution documentation this step presents. */
  docSection: string;
  /** Other sections the step draws on. */
  relatedSections?: string[];
};

export const WALKTHROUGH_STEPS: readonly WalkthroughStep[] = [
  {
    slug: "batch",
    title: "Batch architecture",
    docSection: "31.1",
    relatedSections: ["8"],
  },
  {
    slug: "matching",
    title: "Deterministic matching",
    docSection: "31.2",
    relatedSections: ["10", "11"],
  },
  {
    slug: "price-variance",
    title: "Price-variance case",
    docSection: "31.3",
    relatedSections: ["9"],
  },
  {
    slug: "investigation",
    title: "Agent tool usage",
    docSection: "31.4",
    relatedSections: ["12", "13"],
  },
  {
    slug: "recommendation",
    title: "Structured recommendation",
    docSection: "31.5",
    relatedSections: ["14"],
  },
  {
    slug: "governance",
    title: "Deterministic governance",
    docSection: "31.6",
    relatedSections: ["15", "24"],
  },
  {
    slug: "review",
    title: "Human review",
    docSection: "31.7",
    relatedSections: ["16"],
  },
  {
    slug: "audit",
    title: "Audit record",
    docSection: "31.8",
    relatedSections: ["17"],
  },
  {
    slug: "evaluation",
    title: "Evaluation and release gates",
    docSection: "31.9",
    relatedSections: ["18", "19", "21"],
  },
  {
    slug: "red-team",
    title: "Red-team dataset",
    docSection: "31.10",
    relatedSections: ["20"],
  },
  { slug: "summary", title: "Summary", docSection: "31.11" },
];

export function stepHref(slug: string) {
  return `/walkthrough/${slug}`;
}

export function stepIndex(slug: string) {
  const index = WALKTHROUGH_STEPS.findIndex((s) => s.slug === slug);
  if (index === -1) throw new Error(`Unknown walkthrough step: ${slug}`);
  return index;
}
