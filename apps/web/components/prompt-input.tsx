"use client";

import type { SteeringInputs, TargetModel, PromptMode } from "@prompt-engineer/validators";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { TargetModelSelect } from "./target-model-select";
import { TaskTypeTags } from "./task-type-tags";
import { SteeringDials } from "./steering-dials";
import { ModeToggle } from "./mode-toggle";
import { Loader2 } from "lucide-react";

interface PromptInputProps {
  rawPrompt: string;
  onRawPromptChange: (value: string) => void;
  targetModel: TargetModel;
  onTargetModelChange: (value: TargetModel) => void;
  steeringInputs: SteeringInputs;
  onSteeringInputsChange: (value: SteeringInputs) => void;
  mode: PromptMode;
  onModeChange: (value: PromptMode) => void;
  onSubmit: () => void;
  isLoading: boolean;
  error: string | null;
}

export function PromptInput({
  rawPrompt,
  onRawPromptChange,
  targetModel,
  onTargetModelChange,
  steeringInputs,
  onSteeringInputsChange,
  mode,
  onModeChange,
  onSubmit,
  isLoading,
  error,
}: PromptInputProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">Your Prompt</label>
        <Textarea
          value={rawPrompt}
          onChange={(e) => onRawPromptChange(e.target.value)}
          placeholder="Describe what you want the AI to do..."
          className="min-h-[140px] resize-y text-base"
          disabled={isLoading}
        />
      </div>

      <TargetModelSelect value={targetModel} onChange={onTargetModelChange} />

      <TaskTypeTags
        selected={steeringInputs.taskType}
        onChange={(taskType) =>
          onSteeringInputsChange({
            ...steeringInputs,
            taskType,
            categoryDials: taskType !== steeringInputs.taskType ? undefined : steeringInputs.categoryDials,
          })
        }
      />

      <SteeringDials
        steeringInputs={steeringInputs}
        onChange={onSteeringInputsChange}
      />

      <div className="flex items-center justify-between pt-2">
        <ModeToggle mode={mode} onChange={onModeChange} />
        <Button
          onClick={onSubmit}
          disabled={isLoading || !rawPrompt.trim()}
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            "Enhance My Prompt"
          )}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
