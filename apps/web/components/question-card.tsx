"use client";

import type { ClarificationQuestion } from "@prompt-engineer/validators";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface QuestionCardProps {
  question: ClarificationQuestion;
  answer: string | null;
  onChange: (value: string | null) => void;
}

export function QuestionCard({ question, answer, onChange }: QuestionCardProps) {
  return (
    <Card className="p-5 transition-all duration-200 hover:border-white/[0.1]">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">{question.question}</p>
          <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">{question.why}</p>
        </div>

        {question.type === "select" && question.options && (
          <Select
            value={answer ?? question.default}
            onValueChange={(v) => onChange(v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {question.options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {question.type === "text" && (
          <Textarea
            value={answer ?? question.default}
            onChange={(e) => onChange(e.target.value)}
            placeholder={question.default}
            className="min-h-[80px] text-sm"
          />
        )}

        {question.type === "scale" && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-600 font-mono">1</span>
            <Slider
              value={[parseInt(answer ?? question.default ?? "3", 10)]}
              onValueChange={(v) => onChange(String(v[0]))}
              min={1}
              max={5}
              step={1}
              className="flex-1"
            />
            <span className="text-xs text-zinc-600 font-mono">5</span>
          </div>
        )}
      </div>
    </Card>
  );
}
