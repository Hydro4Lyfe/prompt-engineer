import { z } from "zod";
import {
  PromptMode,
  PromptCategory,
  SessionStatus,
  UserTier,
  ClarificationQuestion,
} from "./common.schema";
import { TargetModel, SteeringInputs } from "./steering.schema";

// ── Request Schemas ────────────────────────────────────

export const AnalyzeInput = z.object({
  rawPrompt: z.string().min(1).max(5000),
  mode: PromptMode.optional(),
  targetModel: TargetModel.optional(),
  steeringInputs: SteeringInputs.optional(),
});
export type AnalyzeInput = z.infer<typeof AnalyzeInput>;

export const AnswersInput = z.object({
  answers: z.record(z.string(), z.string().nullable()),
});
export type AnswersInput = z.infer<typeof AnswersInput>;

export const RegenInput = z.object({
  emphasis: z.string().max(500).optional(),
});
export type RegenInput = z.infer<typeof RegenInput>;

export const ListSessionsInput = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
export type ListSessionsInput = z.infer<typeof ListSessionsInput>;

// ── Response Schemas ───────────────────────────────────

export const AnalysisResponse = z.object({
  intent: z.string(),
  category: PromptCategory,
  suggestedMode: PromptMode,
  detectedElements: z.array(z.string()),
  missingElements: z.array(z.string()),
  questions: z.array(ClarificationQuestion),
});
export type AnalysisResponse = z.infer<typeof AnalysisResponse>;

export const SynthesisResponse = z.object({
  finalPrompt: z.string(),
  changelog: z.array(z.string()),
  tips: z.array(z.string()).optional(),
  metadata: z.object({
    category: PromptCategory,
    tokensUsed: z.number(),
    modelUsed: z.string(),
  }),
});
export type SynthesisResponse = z.infer<typeof SynthesisResponse>;

export const SessionResponse = z.object({
  id: z.string(),
  rawPrompt: z.string().nullable(),
  mode: PromptMode,
  status: SessionStatus,
  category: PromptCategory.nullable(),
  intent: z.string().nullable(),
  detectedElements: z.array(z.string()).nullable(),
  questions: z.array(ClarificationQuestion).nullable(),
  answers: z.record(z.string(), z.string().nullable()).nullable(),
  finalPrompt: z.string().nullable(),
  changelog: z.array(z.string()).nullable(),
  tokensUsed: z.number().nullable(),
  modelUsed: z.string().nullable(),
  versions: z.array(z.any()).nullable(),
  steeringInputs: z.any().nullable(),
  targetModel: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SessionResponse = z.infer<typeof SessionResponse>;

export const UsageResponse = z.object({
  tier: UserTier,
  tokensUsedToday: z.number(),
  tokensUsedMonth: z.number(),
  sessionsToday: z.number(),
  sessionsMonth: z.number(),
  limits: z.object({
    dailySessions: z.number(),
    monthlySessions: z.number(),
    dailyTokens: z.number(),
    monthlyTokens: z.number(),
    detailedMode: z.boolean(),
    history: z.boolean(),
  }),
  stripe: z
    .object({
      customerId: z.string().nullable(),
      subscriptionId: z.string().nullable(),
      currentPeriodEnd: z.string().datetime().nullable(),
    })
    .optional(),
});
export type UsageResponse = z.infer<typeof UsageResponse>;

export const ErrorResponse = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;
