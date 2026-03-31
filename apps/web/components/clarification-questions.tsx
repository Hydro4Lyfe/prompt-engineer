"use client";

import type { ClarificationQuestion } from "@prompt-engineer/validators";
import { Button } from "@/components/ui/button";
import { QuestionCard } from "./question-card";
import { ContextBar } from "./context-bar";
import { Loader2, Wand2 } from "lucide-react";

interface ClarificationQuestionsProps {
  rawPrompt: string;
  category: string | null;
  targetModel: string;
  questions: ClarificationQuestion[];
  answers: Record<string, string | null>;
  onAnswerChange: (questionId: string, value: string | null) => void;
  onSubmit: () => void;
  onBack: () => void;
  isLoading: boolean;
  error: string | null;
}

export function ClarificationQuestions({
  rawPrompt,
  category,
  targetModel,
  questions,
  answers,
  onAnswerChange,
  onSubmit,
  onBack,
  isLoading,
  error,
}: ClarificationQuestionsProps) {
  const handleSkipRemaining = () => {
    onSubmit();
  };

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

      <div className="animate-fade-up stagger-2">
        <h2 className="text-lg font-display font-semibold text-zinc-100 mb-1">
          A few questions first
        </h2>
        <p className="text-sm text-zinc-500">Help us understand your intent for a better result.</p>
      </div>

      <div className="flex flex-col gap-3">
        {questions.map((q, i) => (
          <div key={q.id} className={`animate-fade-up stagger-${Math.min(i + 3, 7)}`}>
            <QuestionCard
              question={q}
              answer={answers[q.id] ?? null}
              onChange={(value) => onAnswerChange(q.id, value)}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 animate-fade-up stagger-7">
        <button
          onClick={handleSkipRemaining}
          className="text-sm text-zinc-600 hover:text-violet-400 transition-colors duration-200"
          disabled={isLoading}
        >
          Skip remaining & use defaults
        </button>
        <Button onClick={onSubmit} disabled={isLoading} size="lg">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" />
              Generate Prompt
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
