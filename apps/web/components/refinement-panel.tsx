"use client";

import { useState } from "react";
import type {
  PromptCategory,
  SteeringInputs,
} from "@prompt-engineer/validators";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, RefreshCw, Loader2 } from "lucide-react";
import { ProTips } from "./pro-tips";
import { SteeringDials } from "./steering-dials";
import { RefineInput } from "./refine-input";

interface RefinementPanelProps {
  // Tips
  aiTips: string[];
  category: PromptCategory | null;
  appliedTips: string[];
  onApplyTip: (tip: string) => void;
  // Steering
  steeringInputs: SteeringInputs;
  onSteeringInputsChange: (inputs: SteeringInputs) => void;
  steeringDirty: boolean;
  onRegenerateWithSteering: () => void;
  // Refine
  onRefine: (instruction: string) => Promise<void>;
  isRefining: boolean;
}

export function RefinementPanel({
  aiTips,
  category,
  appliedTips,
  onApplyTip,
  steeringInputs,
  onSteeringInputsChange,
  steeringDirty,
  onRegenerateWithSteering,
  onRefine,
  isRefining,
}: RefinementPanelProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-lg border border-zinc-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
      >
        <span>Refine Your Prompt</span>
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-zinc-100 px-4 py-4 flex flex-col gap-6">
          {/* Pro Tips */}
          <ProTips
            aiTips={aiTips}
            category={category}
            appliedTips={appliedTips}
            onApplyTip={onApplyTip}
          />

          {/* Steering Dials */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-medium text-zinc-500">
              Steering Dials
            </span>
            <SteeringDials
              steeringInputs={steeringInputs}
              onChange={onSteeringInputsChange}
            />
            {steeringDirty && (
              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  onClick={onRegenerateWithSteering}
                  disabled={isRefining}
                >
                  {isRefining ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-1.5 h-4 w-4" />
                      Refresh Prompt
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Free-text Refine */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-zinc-500">
              Custom Refinement
            </span>
            <RefineInput onRefine={onRefine} isRefining={isRefining} />
          </div>
        </div>
      )}
    </div>
  );
}
