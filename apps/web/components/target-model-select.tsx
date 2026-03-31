"use client";

import type { TargetModel } from "@prompt-engineer/validators";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MODEL_OPTIONS: { value: TargetModel; label: string }[] = [
  { value: "claude", label: "Claude (Anthropic)" },
  { value: "gpt-4", label: "GPT-4 (OpenAI)" },
  { value: "gemini", label: "Gemini (Google)" },
  { value: "llama", label: "Llama (Meta)" },
  { value: "mistral", label: "Mistral" },
  { value: "other", label: "Other" },
];

interface TargetModelSelectProps {
  value: TargetModel;
  onChange: (value: TargetModel) => void;
}

export function TargetModelSelect({ value, onChange }: TargetModelSelectProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-zinc-400">
        Target AI Model
      </label>
      <Select value={value} onValueChange={(v) => onChange(v as TargetModel)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MODEL_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
