"use client";

import type { PromptCategory } from "@prompt-engineer/validators";
import { cn } from "@/lib/utils";

const CATEGORIES: { value: PromptCategory; label: string; icon: string }[] = [
  { value: "WRITING", label: "Writing", icon: "pen" },
  { value: "CODING", label: "Coding", icon: "code" },
  { value: "RESEARCH", label: "Research", icon: "search" },
  { value: "BUSINESS", label: "Business", icon: "briefcase" },
  { value: "CREATIVE", label: "Creative", icon: "palette" },
  { value: "EDUCATIONAL", label: "Educational", icon: "book" },
];

interface TaskTypeTagsProps {
  selected: PromptCategory | undefined;
  onChange: (category: PromptCategory | undefined) => void;
}

export function TaskTypeTags({ selected, onChange }: TaskTypeTagsProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-zinc-400">
        Task Type <span className="font-normal text-zinc-600">(optional)</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() =>
              onChange(selected === cat.value ? undefined : cat.value)
            }
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200",
              selected === cat.value
                ? "border-violet-500/50 bg-violet-500/15 text-violet-300 shadow-sm shadow-violet-500/10"
                : "border-white/[0.08] text-zinc-500 hover:border-white/[0.15] hover:text-zinc-300 hover:bg-white/[0.03]"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
}
