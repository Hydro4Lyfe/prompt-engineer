"use client";

import { useState } from "react";
import type { SynthesisResponse } from "@prompt-engineer/validators";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ContextBar } from "./context-bar";
import { CopyButton } from "./copy-button";
import { ChevronDown, ChevronUp, Pencil, Eye, RotateCcw, RefreshCw } from "lucide-react";

interface PromptResultProps {
  rawPrompt: string;
  category: string | null;
  targetModel: string;
  result: SynthesisResponse;
  onBack: () => void;
  onStartOver: () => void;
}

export function PromptResult({
  rawPrompt,
  category,
  targetModel,
  result,
  onBack,
  onStartOver,
}: PromptResultProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(result.finalPrompt);
  const [changelogOpen, setChangelogOpen] = useState(true);

  const displayPrompt = isEditing ? editedPrompt : result.finalPrompt;

  return (
    <div className="flex flex-col gap-5">
      <ContextBar
        rawPrompt={rawPrompt}
        category={category}
        targetModel={targetModel}
        onBack={onBack}
      />

      <Card className="relative p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            Enhanced Prompt
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? (
                <>
                  <Eye className="mr-1.5 h-4 w-4" />
                  Preview
                </>
              ) : (
                <>
                  <Pencil className="mr-1.5 h-4 w-4" />
                  Edit
                </>
              )}
            </Button>
            <CopyButton text={displayPrompt} />
          </div>
        </div>

        {isEditing ? (
          <Textarea
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            className="min-h-[200px] text-sm font-mono"
          />
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
            {displayPrompt}
          </div>
        )}
      </Card>

      <div className="rounded-lg border border-zinc-200">
        <button
          onClick={() => setChangelogOpen(!changelogOpen)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          <span>What was improved</span>
          {changelogOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {changelogOpen && (
          <ul className="border-t border-zinc-100 px-4 py-3 space-y-2">
            {result.changelog.map((item, i) => (
              <li key={i} className="text-sm text-zinc-600 flex gap-2">
                <span className="text-zinc-400 mt-0.5">-</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button variant="outline" onClick={onStartOver}>
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Start Over
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="outline" disabled>
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                  Regenerate
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Pro feature — coming soon</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
