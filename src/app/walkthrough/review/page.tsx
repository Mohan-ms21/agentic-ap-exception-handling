import Link from "next/link";
import { GovernanceResult } from "@/components/governance-panel";
import { StepPage } from "@/components/step-page";
import { Badge } from "@/components/ui/badge";
import { CodeValue } from "@/components/ui/code-value";
import { KeyValues } from "@/components/ui/key-values";
import { Panel } from "@/components/ui/panel";
import { caseAgentDecision } from "@/lib/domain/case";
import { executionState } from "@/lib/presentation";
import { loadWalkthroughCase } from "@/lib/server/demo";
import { stepHref } from "@/lib/walkthrough";
import { ResetDemoButton } from "./reset-demo-button";
import { ReviewForm } from "./review-form";

export default async function ReviewStep() {
  const exceptionCase = await loadWalkthroughCase();
  const decision = caseAgentDecision(exceptionCase);
  const state = executionState(exceptionCase.workflowStatus);
  const waiting = exceptionCase.workflowStatus === "WAITING_FOR_HUMAN_REVIEW";

  return (
    <StepPage
      slug="review"
      lead="Automation was blocked, so the execution paused and an analyst decides: accept the recommendation, override it, or escalate. The same execution resumes with the decision."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Agent recommendation">
          {decision && (
            <KeyValues
              items={[
                {
                  label: "Root cause",
                  value: <CodeValue>{decision.rootCause}</CodeValue>,
                },
                {
                  label: "Recommended action",
                  value: <CodeValue>{decision.recommendedAction}</CodeValue>,
                },
                {
                  label: "Risk",
                  value: <CodeValue>{decision.riskLevel}</CodeValue>,
                },
                { label: "Explanation", value: decision.explanation },
              ]}
            />
          )}
        </Panel>
        <Panel title="Policy decision">
          {exceptionCase.governance && (
            <GovernanceResult governance={exceptionCase.governance} />
          )}
        </Panel>
      </div>

      {waiting ? (
        <Panel
          title="AP exception review"
          description="In n8n this is the signed runtime form of the Wait node; here it records the same fields."
        >
          <div className="space-y-5">
            <p className="rounded-md border border-dashed border-amber-400 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              Demo only: the reviewer is not authenticated and the name is
              recorded as typed. Production needs authenticated analyst access,
              SSO and role-based access, and an audited reviewer identity
              (§24.4).
            </p>
            {decision && (
              <ReviewForm
                caseId={exceptionCase.caseId}
                recommendedAction={decision.recommendedAction}
              />
            )}
          </div>
        </Panel>
      ) : (
        <Panel title="Review recorded" actions={<ResetDemoButton />}>
          <div className="space-y-4">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={state.tone}>{state.label}</Badge>
              <span>{state.detail}</span>
              {exceptionCase.nextAction && (
                <span>
                  · next action{" "}
                  <CodeValue>{exceptionCase.nextAction}</CodeValue>
                </span>
              )}
            </p>
            {exceptionCase.humanReview && (
              <KeyValues
                items={[
                  {
                    label: "Decision",
                    value: (
                      <CodeValue>
                        {exceptionCase.humanReview.decision}
                      </CodeValue>
                    ),
                  },
                  {
                    label: "Reviewer",
                    value: exceptionCase.humanReview.reviewer,
                  },
                  {
                    label: "Notes",
                    value: exceptionCase.humanReview.notes || "—",
                  },
                  {
                    label: "Override action",
                    value: exceptionCase.humanReview.overrideAction ? (
                      <CodeValue>
                        {exceptionCase.humanReview.overrideAction}
                      </CodeValue>
                    ) : (
                      "—"
                    ),
                  },
                  {
                    label: "Reviewed",
                    value: exceptionCase.humanReview.reviewedAt,
                  },
                ]}
              />
            )}
            <p className="text-sm">
              <Link
                href={stepHref("audit")}
                className="font-medium underline underline-offset-2"
              >
                See the audit record →
              </Link>
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Demo state is held in server memory and shared by everyone viewing
              this deployment. Reset returns the batch to its starting state.
            </p>
          </div>
        </Panel>
      )}
    </StepPage>
  );
}
