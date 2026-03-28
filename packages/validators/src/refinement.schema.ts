import { z } from "zod";
import { SteeringInputs } from "./steering.schema";

export const PromptVersion = z.object({
  id: z.string(),
  prompt: z.string(),
  changelog: z.array(z.string()).optional(),
  tips: z.array(z.string()).optional(),
  trigger: z.enum(["synthesis", "tip", "refine", "regenerate"]),
  description: z.string(),
  createdAt: z.string(),
});
export type PromptVersion = z.infer<typeof PromptVersion>;

export const RefineInput = z.object({
  currentPrompt: z.string().min(1).max(10000),
  instruction: z.string().min(1).max(1000),
});
export type RefineInput = z.infer<typeof RefineInput>;

export const RefineResponse = z.object({
  finalPrompt: z.string(),
  description: z.string(),
});
export type RefineResponse = z.infer<typeof RefineResponse>;

export const RegenerateInput = z.object({
  steeringInputs: SteeringInputs,
});
export type RegenerateInput = z.infer<typeof RegenerateInput>;
