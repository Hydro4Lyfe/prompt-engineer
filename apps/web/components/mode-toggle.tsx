"use client";

import type { PromptMode } from "@prompt-engineer/validators";

interface ModeToggleProps {
  mode: PromptMode;
  onChange: (mode: PromptMode) => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-zinc-500">Mode:</span>
      <div className="flex rounded-xl border border-white/[0.08] overflow-hidden">
        <button
          onClick={() => onChange("quick")}
          className={`px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
            mode === "quick"
              ? "bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-inner"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
          }`}
        >
          Quick
        </button>
        <button
          onClick={() => onChange("detailed")}
          className={`px-4 py-1.5 text-sm font-medium transition-all duration-200 border-l border-white/[0.08] ${
            mode === "detailed"
              ? "bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-inner"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
          }`}
        >
          Detailed
        </button>
      </div>
    </div>
  );
}
