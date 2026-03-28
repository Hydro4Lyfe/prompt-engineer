"use client";

import { useState, useEffect } from "react";
import type {
  SynthesisResponse,
  PromptVersion,
  PromptCategory,
  SteeringInputs,
} from "@prompt-engineer/validators";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
      <ContextBar
        rawPrompt={rawPrompt}
        category={category}
        targetModel={targetModel}
        onBack={onBack}
      />

      <Card className="relative p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">
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
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
            {displayPrompt}
          </div>
        )}
      </Card>

      {currentChangelog && currentChangelog.length > 0 && (
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
              {currentChangelog.map((item, i) => (
                <li key={i} className="text-sm text-zinc-600 flex gap-2">
                  <span className="text-zinc-400 mt-0.5">-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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

      <div className="flex items-center gap-3 pt-2">
        <Button variant="outline" onClick={onStartOver}>
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Start Over
        </Button>
      </div>
    </div>
  );
}
