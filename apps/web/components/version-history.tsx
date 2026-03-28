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
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
      >
        <span>
          v{activeIndex + 1} of {versions.length}
        </span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-1 w-72 rounded-lg border border-zinc-200 bg-white shadow-lg">
          <div className="px-3 py-2 border-b border-zinc-100">
            <span className="text-xs font-medium text-zinc-500">
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
                  className={`flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">v{i + 1}</span>
                      <span className="text-xs text-zinc-400">
                        {version.trigger}
                      </span>
                    </div>
                    <p className="truncate text-xs text-zinc-500">
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
