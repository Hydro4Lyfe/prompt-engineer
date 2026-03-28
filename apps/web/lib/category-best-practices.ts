import type { PromptCategory } from "@prompt-engineer/validators";

export const CATEGORY_BEST_PRACTICES: Record<PromptCategory, string[]> = {
  CODING: [
    "Include error handling expectations",
    "Specify testing requirements",
    "Define the target runtime environment",
  ],
  WRITING: [
    "Specify the target audience explicitly",
    "Include a style reference or example",
    "Define the desired format (bullet points, paragraphs, etc.)",
  ],
  RESEARCH: [
    "Specify preferred source types (academic, industry, etc.)",
    "Define the expected depth of analysis",
    "Request citations or references",
  ],
  BUSINESS: [
    "Include specific metrics or KPIs to reference",
    "Specify the decision-maker audience",
    "Define the expected deliverable format",
  ],
  CREATIVE: [
    "Include mood or atmosphere references",
    "Specify any content boundaries or constraints",
    "Define the intended medium or platform",
  ],
  EDUCATIONAL: [
    "Specify prerequisite knowledge assumptions",
    "Include assessment or practice opportunities",
    "Define the learning objectives clearly",
  ],
};
