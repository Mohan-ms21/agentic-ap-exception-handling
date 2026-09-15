"use client";

import {
  startTransition,
  useActionState,
  useState,
  type FormEvent,
} from "react";
import { recommendedActionSchema } from "@/lib/domain/resolution";
import { submitReview, type ReviewFormState } from "./actions";

const DECISIONS = [
  {
    value: "ACCEPT_RECOMMENDATION",
    label: "Accept recommendation",
    detail: "The final action is the agent's recommended action.",
  },
  {
    value: "OVERRIDE_RECOMMENDATION",
    label: "Override recommendation",
    detail: "The final action is the one you choose. Notes are required.",
  },
  {
    value: "ESCALATE",
    label: "Escalate to AP manager",
    detail: "The case is routed for AP manager review. Notes are required.",
  },
] as const;

const field =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p className="mt-1 text-xs text-red-700 dark:text-red-300">{errors[0]}</p>
  );
}

export function ReviewForm({
  caseId,
  recommendedAction,
}: {
  caseId: string;
  recommendedAction: string;
}) {
  const [state, action, pending] = useActionState<ReviewFormState, FormData>(
    submitReview,
    {
      status: "idle",
    },
  );
  const [decision, setDecision] = useState<string>("ACCEPT_RECOMMENDATION");
  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};
  const notesRequired = decision !== "ACCEPT_RECOMMENDATION";

  // Submitting through a transition rather than the form's action prop, so
  // React does not reset the fields when validation fails.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="caseId" value={caseId} />

      <fieldset>
        <legend className="text-sm font-medium">Decision</legend>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {DECISIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-2 rounded-md border p-3 text-sm ${
                decision === option.value
                  ? "border-neutral-900 dark:border-neutral-100"
                  : "border-neutral-300 dark:border-neutral-700"
              }`}
            >
              <input
                type="radio"
                name="reviewDecision"
                value={option.value}
                checked={decision === option.value}
                onChange={() => setDecision(option.value)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="block text-xs text-neutral-600 dark:text-neutral-400">
                  {option.value === "ACCEPT_RECOMMENDATION"
                    ? `The final action is ${recommendedAction}.`
                    : option.detail}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {decision === "OVERRIDE_RECOMMENDATION" && (
        <div>
          <label htmlFor="overrideAction" className="text-sm font-medium">
            Override action
          </label>
          <select
            id="overrideAction"
            name="overrideAction"
            defaultValue=""
            className={`mt-1 ${field}`}
          >
            <option value="" disabled>
              Choose an action
            </option>
            {recommendedActionSchema.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <FieldError errors={fieldErrors.overrideAction} />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="reviewerName" className="text-sm font-medium">
            Reviewer name
          </label>
          <input
            id="reviewerName"
            name="reviewerName"
            defaultValue="AP Analyst"
            className={`mt-1 ${field}`}
          />
          <FieldError errors={fieldErrors.reviewerName} />
        </div>
        <div>
          <label htmlFor="reviewNotes" className="text-sm font-medium">
            Review notes{" "}
            <span className="font-normal text-neutral-500">
              {notesRequired ? "(required for the audit record)" : "(optional)"}
            </span>
          </label>
          <textarea
            id="reviewNotes"
            name="reviewNotes"
            rows={3}
            defaultValue={
              decision === "ACCEPT_RECOMMENDATION" ? "Route this to Buyer" : ""
            }
            key={decision}
            className={`mt-1 ${field}`}
          />
          <FieldError errors={fieldErrors.reviewNotes} />
        </div>
      </div>

      {(state.status === "invalid" || state.status === "failed") && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
      >
        {pending ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
