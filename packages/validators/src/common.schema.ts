import { z } from "zod";

export const PromptMode = z.enum(["quick", "detailed"]);
export type PromptMode = z.infer<typeof PromptMode>;

export const PromptCategory = z.enum([
  "WRITING",
  "CODING",
  "RESEARCH",
  "BUSINESS",
  "CREATIVE",
  "EDUCATIONAL",
]);
export type PromptCategory = z.infer<typeof PromptCategory>;

export const SessionStatus = z.enum([
  "CREATED",
  "ANALYZING",
  "QUESTIONS_READY",
  "ANSWERS_SUBMITTED",
  "GENERATING",
  "COMPLETED",
  "FAILED",
]);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const UserTier = z.enum(["FREE", "PRO", "TEAM"]);
export type UserTier = z.infer<typeof UserTier>;

export const QuestionType = z.enum(["select", "text", "scale"]);
export type QuestionType = z.infer<typeof QuestionType>;

export const ClarificationQuestion = z.object({
  id: z.string(),
  question: z.string(),
  why: z.string(),
  default: z.string(),
  priority: z.number().int().min(1).max(5),
  type: QuestionType,
  options: z.array(z.string()).optional(),
});
export type ClarificationQuestion = z.infer<typeof ClarificationQuestion>;
