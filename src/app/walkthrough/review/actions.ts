"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  DataSourceError,
  getDataSource,
  resetDemoState,
} from "@/lib/data-source";
import { humanReviewSubmissionSchema } from "@/lib/domain/review";

// Server Actions are reachable by direct POST, not only through this form.
// The demo has no authentication (section 24.4): the submission is
// validated here and again by the data source, and the reviewer name is
// recorded as entered.

export type ReviewFormState =
  | { status: "idle" }
  | {
      status: "invalid";
      message: string;
      fieldErrors: Record<string, string[] | undefined>;
    }
  | { status: "failed"; message: string };

const FIELD_MESSAGES: Record<string, string> = {
  reviewDecision: "Choose accept, override or escalate.",
  reviewerName: "Enter the reviewer's name.",
  reviewNotes: "Notes are required when overriding or escalating.",
  overrideAction: "Choose one of the four recommended actions.",
};

const optional = (value: FormDataEntryValue | null) =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

export async function submitReview(
  _previous: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const caseId = formData.get("caseId");
  const reviewDecision = formData.get("reviewDecision");
  const parsed = humanReviewSubmissionSchema.safeParse({
    reviewDecision,
    reviewerName: formData.get("reviewerName") ?? "",
    reviewNotes: optional(formData.get("reviewNotes")),
    ...(reviewDecision === "OVERRIDE_RECOMMENDATION"
      ? { overrideAction: formData.get("overrideAction") ?? "" }
      : {}),
  });
  if (!parsed.success) {
    const invalid = new Set(
      Object.keys(z.flattenError(parsed.error).fieldErrors),
    );
    const fieldErrors: Record<string, string[] | undefined> = {};
    for (const [fieldName, message] of Object.entries(FIELD_MESSAGES)) {
      if (invalid.has(fieldName)) fieldErrors[fieldName] = [message];
    }
    return {
      status: "invalid",
      message: "Check the highlighted fields.",
      fieldErrors,
    };
  }
  if (typeof caseId !== "string") {
    return { status: "failed", message: "Missing case id." };
  }

  try {
    await getDataSource().submitHumanReview(caseId, parsed.data);
  } catch (error) {
    if (error instanceof DataSourceError) {
      return { status: "failed", message: error.message };
    }
    throw error;
  }
  refresh();
  return { status: "idle" };
}

export async function resetDemo(): Promise<void> {
  resetDemoState();
  refresh();
}
