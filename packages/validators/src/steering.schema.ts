import { z } from "zod";
import { PromptCategory } from "./common.schema";

export const TargetModel = z.enum([
  "claude",
  "gpt-4",
  "gemini",
  "llama",
  "mistral",
  "other",
]);
export type TargetModel = z.infer<typeof TargetModel>;

export const SteeringInputs = z.object({
  taskType: PromptCategory.optional(),
  tone: z.number().min(0).max(100).default(50),
  detailLevel: z.number().min(0).max(100).default(50),
  categoryDials: z
    .record(
      z.string(),
      z.union([z.number(), z.boolean(), z.string()])
    )
    .optional(),
});
export type SteeringInputs = z.infer<typeof SteeringInputs>;
