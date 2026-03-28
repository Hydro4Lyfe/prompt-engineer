"use client";

import type { PromptCategory } from "@prompt-engineer/validators";
import { Check, Lightbulb, BookOpen } from "lucide-react";
import { CATEGORY_BEST_PRACTICES } from "@/lib/category-best-practices";

interface ProTipsProps {
  aiTips: string[];
  category: PromptCategory | null;
  appliedTips: string[];
  onApplyTip: (tip: string) => void;
}

export function ProTips({
  aiTips,
  category,
  appliedTips,
  onApplyTip,
}: ProTipsProps) {
  const categoryTips = category ? CATEGORY_BEST_PRACTICES[category] ?? [] : [];
  const hasAiTips = aiTips.length > 0;
  const hasCategoryTips = categoryTips.length > 0;

  if (!hasAiTips && !hasCategoryTips) return null;

  return (
    <div className="flex flex-col gap-4">
      {hasAiTips && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
            <Lightbulb className="h-3.5 w-3.5" />
            <span>AI Suggestions</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {aiTips.map((tip) => (
              <TipChip
                key={tip}
                tip={tip}
                applied={appliedTips.includes(tip)}
                onApply={() => onApplyTip(tip)}
              />
            ))}
          </div>
        </div>
      )}

      {hasCategoryTips && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Best Practices</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {categoryTips.map((tip) => (
              <TipChip
                key={tip}
                tip={tip}
                applied={appliedTips.includes(tip)}
                onApply={() => onApplyTip(tip)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TipChip({
  tip,
  applied,
  onApply,
}: {
  tip: string;
  applied: boolean;
  onApply: () => void;
}) {
  return (
    <button
      onClick={onApply}
      disabled={applied}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
        applied
          ? "border-zinc-200 bg-zinc-50 text-zinc-400 cursor-default"
          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
      }`}
    >
      {applied && <Check className="h-3 w-3" />}
      <span>{tip}</span>
    </button>
  );
}
