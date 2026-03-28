"use client";

import type { ClarificationQuestion } from "@prompt-engineer/validators";
import { Button } from "@/components/ui/button";
import { QuestionCard } from "./question-card";
import { ContextBar } from "./context-bar";
import { Loader2 } from "lucide-react";

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
      <ContextBar
        rawPrompt={rawPrompt}
        category={category}
        targetModel={targetModel}
        onBack={onBack}
      />

      <div className="flex flex-col gap-3">
        {questions.map((q) => (
          <QuestionCard
            key={q.id}
            question={q}
            answer={answers[q.id] ?? null}
            onChange={(value) => onAnswerChange(q.id, value)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handleSkipRemaining}
          className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
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
            "Generate Prompt"
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
