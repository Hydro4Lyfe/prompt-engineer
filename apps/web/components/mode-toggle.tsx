"use client";

import type { PromptMode } from "@prompt-engineer/validators";

interface ModeToggleProps {
  mode: PromptMode;
  onChange: (mode: PromptMode) => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-zinc-500">Mode:</span>
      <div className="flex rounded-md border border-zinc-200">
        <button
          onClick={() => onChange("quick")}
          className={`px-3 py-1 text-sm transition-colors ${
            mode === "quick"
              ? "bg-zinc-900 text-white"
              : "text-zinc-600 hover:bg-zinc-50"
          } rounded-l-md`}
        >
          Quick
        </button>
        <button
          onClick={() => onChange("detailed")}
          className={`px-3 py-1 text-sm transition-colors ${
            mode === "detailed"
              ? "bg-zinc-900 text-white"
              : "text-zinc-600 hover:bg-zinc-50"
          } rounded-r-md`}
        >
          Detailed
        </button>
      </div>
    </div>
  );
}
