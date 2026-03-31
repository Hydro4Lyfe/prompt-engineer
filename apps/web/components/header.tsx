"use client";

import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-white/[0.06] px-6 py-3 backdrop-blur-xl bg-zinc-950/70 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-display font-bold tracking-tight gradient-text">
          Prompt Engineer
        </h1>
      </div>
    </header>
  );
}
