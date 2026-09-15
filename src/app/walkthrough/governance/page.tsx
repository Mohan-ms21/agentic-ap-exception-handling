import Link from "next/link";
import {
  AutomationCriteria,
  EvidenceVerificationResult,
  GovernanceResult,
  PolicyEvidenceNote,
} from "@/components/governance-panel";
import { StepPage } from "@/components/step-page";
import { Panel } from "@/components/ui/panel";
import { caseAgentDecision } from "@/lib/domain/case";
import { loadWalkthroughCase } from "@/lib/server/demo";
import { stepHref } from "@/lib/walkthrough";

export default async function GovernanceStep() {
  const exceptionCase = await loadWalkthroughCase();
  const decision = caseAgentDecision(exceptionCase);
  const { governance } = exceptionCase;

  return (
    <StepPage
      slug="governance"
      lead="The model's confidence is not authorization. After the agent recommends, a deterministic policy decides whether the resolution may be automated. The agent cannot change the policy or its outcome."
    >
      {governance && decision ? (
        <>
          <Panel title="Policy decision">
            <GovernanceResult governance={governance} />
          </Panel>
          <Panel
            title="Automation conditions"
            description="Price variance policy (ported n8n Apply Resolution Risk Policy)"
          >
            <AutomationCriteria decision={decision} />
          </Panel>
          {governance.evidenceVerification && (
            <Panel title="Evidence verification">
              <EvidenceVerificationResult
                verification={governance.evidenceVerification}
              />
            </Panel>
          )}
          <PolicyEvidenceNote
            exceptionType={exceptionCase.caseContext.exceptionType}
          />
          <p className="text-sm">
            {governance.automationAllowed
              ? "Automation is allowed by policy, so no analyst review is created."
              : "Automation is blocked by policy, so the case waits for an analyst."}{" "}
            <Link
              href={stepHref("review")}
              className="font-medium underline underline-offset-2"
            >
              Continue to human review →
            </Link>
          </p>
        </>
      ) : (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          This case has not been through governance yet.
        </p>
      )}
    </StepPage>
  );
}
