"use client";

import type { SteeringInputs, TargetModel, PromptMode } from "@prompt-engineer/validators";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { TargetModelSelect } from "./target-model-select";
import { TaskTypeTags } from "./task-type-tags";
import { SteeringDials } from "./steering-dials";
import { ModeToggle } from "./mode-toggle";
import { Loader2, Sparkles } from "lucide-react";

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
      <div className="flex flex-col gap-2 animate-fade-up stagger-1">
        <h2 className="text-2xl font-display font-bold tracking-tight text-zinc-100">
          What do you need?
        </h2>
        <p className="text-sm text-zinc-500">
          Describe your goal and we'll craft the perfect prompt.
        </p>
      </div>

      {/* Two-column layout: prompt left, controls right */}
      <div className="flex gap-6 animate-fade-up stagger-2">
        {/* Left column — prompt textarea, stretches to fill height */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <label className="text-sm font-medium text-zinc-400">Your Prompt</label>
          <Textarea
            value={rawPrompt}
            onChange={(e) => onRawPromptChange(e.target.value)}
            placeholder="Describe what you want the AI to do..."
            className="flex-1 min-h-[320px] resize-none text-base leading-relaxed"
            disabled={isLoading}
          />
        </div>

        {/* Right column — controls panel */}
        <div className="w-72 shrink-0 flex flex-col gap-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 overflow-y-auto max-h-[calc(100vh-220px)]">
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

          <div className="border-t border-white/[0.04] pt-4">
            <SteeringDials
              steeringInputs={steeringInputs}
              onChange={onSteeringInputsChange}
            />
          </div>

          <div className="border-t border-white/[0.04] pt-4">
            <ModeToggle mode={mode} onChange={onModeChange} />
          </div>
        </div>
      </div>

      {/* Submit row — full width below both columns */}
      <div className="flex items-center justify-end animate-fade-up stagger-3">
        <Button
          onClick={onSubmit}
          disabled={isLoading || !rawPrompt.trim()}
          size="lg"
          className={!isLoading && rawPrompt.trim() ? "animate-glow-pulse" : ""}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Enhance My Prompt
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 animate-fade-in">
          {error}
        </div>
      )}
    </div>
  );
}
