"use client";

import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ContextBarProps {
  rawPrompt: string;
  category?: string | null;
  targetModel?: string;
  onBack: () => void;
}

export function ContextBar({
  rawPrompt,
  category,
  targetModel,
  onBack,
}: ContextBarProps) {
  const truncated =
    rawPrompt.length > 80 ? rawPrompt.slice(0, 80) + "..." : rawPrompt;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back</span>
      </button>
      <span className="text-zinc-300">|</span>
      <span className="text-zinc-600 truncate flex-1">{truncated}</span>
      {category && (
        <Badge variant="secondary" className="text-xs">
          {category}
        </Badge>
      )}
      {targetModel && (
        <Badge variant="outline" className="text-xs">
          {targetModel}
        </Badge>
      )}
    </div>
  );
}
