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
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm px-4 py-2.5 text-sm">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-zinc-500 hover:text-violet-400 transition-colors duration-200"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back</span>
      </button>
      <span className="text-white/[0.08]">|</span>
      <span className="text-zinc-400 truncate flex-1">{truncated}</span>
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
