import type { PromptCategory } from "@prompt-engineer/validators";

export interface DialDefinition {
  key: string;
  label: string;
  type: "slider" | "toggle" | "select";
  min?: number;
  max?: number;
  defaultValue?: number;
  minLabel?: string;
  maxLabel?: string;
  defaultChecked?: boolean;
  options?: { value: string; label: string }[];
  defaultOption?: string;
}

export const UNIVERSAL_DIALS: DialDefinition[] = [
  {
    key: "tone",
    label: "Tone",
    type: "slider",
    min: 0,
    max: 100,
    defaultValue: 50,
    minLabel: "Formal",
    maxLabel: "Casual",
  },
  {
    key: "detailLevel",
    label: "Detail Level",
    type: "slider",
    min: 0,
    max: 100,
    defaultValue: 50,
    minLabel: "Concise",
    maxLabel: "Thorough",
  },
];

export const CATEGORY_DIALS: Record<PromptCategory, DialDefinition[]> = {
  CODING: [
    { key: "errorHandling", label: "Error Handling", type: "toggle", defaultChecked: false },
    { key: "includeTests", label: "Include Tests", type: "toggle", defaultChecked: false },
  ],
  WRITING: [
    { key: "length", label: "Length", type: "slider", min: 0, max: 100, defaultValue: 50, minLabel: "Short", maxLabel: "Long" },
    {
      key: "audience",
      label: "Audience",
      type: "select",
      options: [
        { value: "general", label: "General" },
        { value: "technical", label: "Technical" },
        { value: "executive", label: "Executive" },
        { value: "casual", label: "Casual" },
      ],
      defaultOption: "general",
    },
  ],
  RESEARCH: [
    { key: "depth", label: "Depth", type: "slider", min: 0, max: 100, defaultValue: 50, minLabel: "Overview", maxLabel: "Deep Dive" },
    { key: "sourcesRequired", label: "Sources Required", type: "toggle", defaultChecked: false },
  ],
  BUSINESS: [
    { key: "formality", label: "Formality", type: "slider", min: 0, max: 100, defaultValue: 50, minLabel: "Informal", maxLabel: "Formal" },
    { key: "includeMetrics", label: "Include Metrics", type: "toggle", defaultChecked: false },
  ],
  CREATIVE: [
    { key: "creativity", label: "Creativity", type: "slider", min: 0, max: 100, defaultValue: 50, minLabel: "Conservative", maxLabel: "Experimental" },
    { key: "constraints", label: "Use Constraints", type: "toggle", defaultChecked: false },
  ],
  EDUCATIONAL: [
    {
      key: "learnerLevel",
      label: "Learner Level",
      type: "select",
      options: [
        { value: "beginner", label: "Beginner" },
        { value: "intermediate", label: "Intermediate" },
        { value: "advanced", label: "Advanced" },
      ],
      defaultOption: "beginner",
    },
    { key: "includeAssessment", label: "Include Assessment", type: "toggle", defaultChecked: false },
  ],
};
