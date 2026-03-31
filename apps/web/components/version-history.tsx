"use client";

import { useState, useRef, useEffect } from "react";
import type { PromptVersion } from "@prompt-engineer/validators";
import { ChevronDown, Sparkles, MessageSquare, RefreshCw, Lightbulb } from "lucide-react";

interface VersionHistoryProps {
  versions: PromptVersion[];
  activeIndex: number;
  onNavigate: (index: number) => void;
}

const TRIGGER_ICONS: Record<string, typeof Sparkles> = {
  synthesis: Sparkles,
  tip: Lightbulb,
  refine: MessageSquare,
  regenerate: RefreshCw,
};

export function VersionHistory({
  versions,
  activeIndex,
  onNavigate,
}: VersionHistoryProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  if (versions.length <= 1) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-white/[0.06] hover:text-violet-400 transition-all duration-200"
      >
        <span>
          v{activeIndex + 1} of {versions.length}
        </span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-1 w-72 rounded-xl border border-white/[0.08] bg-zinc-900/95 backdrop-blur-xl shadow-xl shadow-black/30 animate-fade-in">
          <div className="px-3 py-2 border-b border-white/[0.06]">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Version History
            </span>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {versions.map((version, i) => {
              const Icon = TRIGGER_ICONS[version.trigger] ?? Sparkles;
              const isActive = i === activeIndex;
              return (
                <button
                  key={version.id}
                  onClick={() => {
                    onNavigate(i);
                    setOpen(false);
                  }}
                  className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-violet-500/10 text-violet-200"
                      : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                  }`}
                >
                  <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isActive ? "text-violet-400" : "text-zinc-600"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs font-mono">v{i + 1}</span>
                      <span className="text-xs text-zinc-600">
                        {version.trigger}
                      </span>
                    </div>
                    <p className="truncate text-xs text-zinc-500 mt-0.5">
                      {version.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
