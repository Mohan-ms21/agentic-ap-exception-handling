import type { Person, Vendor } from "@/lib/domain/schemas";

// Fictional vendors and roles. Any resemblance to real companies is
// unintended; contact details use the reserved example.com domain.

export const quillfeather: Vendor = {
  id: "vendor-10421",
  vendorNumber: "V-10421",
  name: "Quillfeather Industrial Supply",
  paymentTerms: "NET30",
  defaultCurrency: "USD",
};

export const tallowmere: Vendor = {
  id: "vendor-10587",
  vendorNumber: "V-10587",
  name: "Tallowmere Packaging Co.",
  paymentTerms: "NET45",
  defaultCurrency: "USD",
};

export const veloren: Vendor = {
  id: "vendor-10733",
  vendorNumber: "V-10733",
  name: "Veloren Lab Consumables",
  paymentTerms: "NET30",
  defaultCurrency: "USD",
};

export const facilitiesBuyer: Person = {
  name: "Facilities Buyer (demo)",
  email: "facilities.buyer@example.com",
};

export const packagingBuyer: Person = {
  name: "Packaging Buyer (demo)",
  email: "packaging.buyer@example.com",
};

export const labBuyer: Person = {
  name: "Lab Supplies Buyer (demo)",
  email: "lab.buyer@example.com",
};

export const apReviewer: Person = {
  name: "AP Reviewer (demo)",
  email: "ap.reviewer@example.com",
};
