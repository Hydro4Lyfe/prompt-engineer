"use client";

import { useState, useEffect } from "react";
import type {
  SynthesisResponse,
  PromptVersion,
  PromptCategory,
  SteeringInputs,
} from "@prompt-engineer/validators";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ContextBar } from "./context-bar";
import { CopyButton } from "./copy-button";
import { VersionHistory } from "./version-history";
import { RefinementPanel } from "./refinement-panel";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Eye,
  RotateCcw,
} from "lucide-react";

interface PromptResultProps {
  rawPrompt: string;
  category: string | null;
  targetModel: string;
  result: SynthesisResponse;
  onBack: () => void;
  onStartOver: () => void;
  // Version props
  versions: PromptVersion[];
  activeVersionIndex: number;
  onNavigateVersion: (index: number) => void;
  // Tips props
  currentTips: string[];
  appliedTips: string[];
  onApplyTip: (tip: string) => void;
  // Steering props
  steeringInputs: SteeringInputs;
  onSteeringInputsChange: (inputs: SteeringInputs) => void;
  steeringDirty: boolean;
  onRegenerateWithSteering: () => void;
  // Refine props
  onRefine: (instruction: string) => Promise<void>;
  isRefining: boolean;
}

export function PromptResult({
  rawPrompt,
  category,
  targetModel,
  result,
  onBack,
  onStartOver,
  versions,
  activeVersionIndex,
  onNavigateVersion,
  currentTips,
  appliedTips,
  onApplyTip,
  steeringInputs,
  onSteeringInputsChange,
  steeringDirty,
  onRegenerateWithSteering,
  onRefine,
  isRefining,
}: PromptResultProps) {
  const activeVersion = versions[activeVersionIndex];
  const currentPrompt = activeVersion?.prompt ?? result.finalPrompt;
  const currentChangelog = activeVersion?.changelog ?? result.changelog;

  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(currentPrompt);
  const [changelogOpen, setChangelogOpen] = useState(true);

  // Reset edited prompt when version changes
  useEffect(() => {
    setEditedPrompt(currentPrompt);
    setIsEditing(false);
  }, [currentPrompt]);

  const displayPrompt = isEditing ? editedPrompt : currentPrompt;

  return (
    <div className="flex flex-col gap-5">
      <div className="animate-fade-up stagger-1">
        <ContextBar
          rawPrompt={rawPrompt}
          category={category}
          targetModel={targetModel}
          onBack={onBack}
        />
      </div>

      {/* Hero prompt card with gradient top border */}
      <div className="animate-fade-up stagger-2 gradient-border-top rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl shadow-lg shadow-violet-500/[0.04] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-100">
              Enhanced Prompt
            </h2>
            <VersionHistory
              versions={versions}
              activeIndex={activeVersionIndex}
              onNavigate={onNavigateVersion}
            />
          </div>
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
          <div className="whitespace-pre-wrap text-sm font-mono leading-relaxed text-zinc-300">
            {displayPrompt}
          </div>
        )}
      </div>

      {currentChangelog && currentChangelog.length > 0 && (
        <div className="animate-fade-up stagger-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <button
            onClick={() => setChangelogOpen(!changelogOpen)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-zinc-300 hover:text-zinc-100 transition-colors duration-200"
          >
            <span>What was improved</span>
            {changelogOpen ? (
              <ChevronUp className="h-4 w-4 text-zinc-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            )}
          </button>
          {changelogOpen && (
            <ul className="border-t border-white/[0.04] px-4 py-3 space-y-2">
              {currentChangelog.map((item, i) => (
                <li key={i} className="text-sm text-zinc-400 flex gap-2.5">
                  <span className="text-violet-500 mt-0.5 shrink-0">-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="animate-fade-up stagger-4">
        <RefinementPanel
          aiTips={currentTips}
          category={category as PromptCategory | null}
          appliedTips={appliedTips}
          onApplyTip={onApplyTip}
          steeringInputs={steeringInputs}
          onSteeringInputsChange={onSteeringInputsChange}
          steeringDirty={steeringDirty}
          onRegenerateWithSteering={onRegenerateWithSteering}
          onRefine={onRefine}
          isRefining={isRefining}
        />
      </div>

      <div className="flex items-center gap-3 pt-2 animate-fade-up stagger-5">
        <Button variant="outline" onClick={onStartOver}>
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Start Over
        </Button>
      </div>
    </div>
  );
}
