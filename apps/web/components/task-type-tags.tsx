"use client";

import type { PromptCategory } from "@prompt-engineer/validators";
import { cn } from "@/lib/utils";

const CATEGORIES: { value: PromptCategory; label: string }[] = [
  { value: "WRITING", label: "Writing" },
  { value: "CODING", label: "Coding" },
  { value: "RESEARCH", label: "Research" },
  { value: "BUSINESS", label: "Business" },
  { value: "CREATIVE", label: "Creative" },
  { value: "EDUCATIONAL", label: "Educational" },
];

interface TaskTypeTagsProps {
  selected: PromptCategory | undefined;
  onChange: (category: PromptCategory | undefined) => void;
}

export function TaskTypeTags({ selected, onChange }: TaskTypeTagsProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-700">
        Task Type <span className="font-normal text-zinc-400">(optional)</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() =>
              onChange(selected === cat.value ? undefined : cat.value)
            }
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              selected === cat.value
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
}
