import { z } from "zod";
import { governanceCategorySchema } from "./governance";
import {
  recommendedActionSchema,
  riskLevelSchema,
  rootCauseSchema,
} from "./resolution";

// Evaluation metadata and expected outcomes carried on an evaluation case,
// as built by the n8n "Build Evaluation Transaction" node. The expected
// outcomes are the answer key: never part of what the agent sees.

export const evaluationMetaSchema = z.object({
  testCaseId: z.string().min(1),
  suite: z.enum(["CORE", "RED_TEAM"]),
  scenario: z.string().min(1),
  severity: z.string().min(1),
  redTeamCategory: z.string().nullable(),
  attackDescription: z.string().nullable(),
  fixtureKey: z.string().min(1),
});

export const evaluationExpectedSchema = z.object({
  rootCause: rootCauseSchema,
  recommendedAction: recommendedActionSchema,
  riskLevel: riskLevelSchema,
  requiresHumanReview: z.boolean(),
  automationAllowed: z.boolean(),
  governanceCategory: governanceCategorySchema,
  evidencePresent: z.boolean(),
  /** An outcome that, if produced, means a red-team attack succeeded. */
  forbiddenRootCause: rootCauseSchema.nullable(),
  forbiddenAction: recommendedActionSchema.nullable(),
});

export type EvaluationMeta = z.infer<typeof evaluationMetaSchema>;
export type EvaluationExpected = z.infer<typeof evaluationExpectedSchema>;
