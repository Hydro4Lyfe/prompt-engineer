"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface RefineInputProps {
  onRefine: (instruction: string) => Promise<void>;
  isRefining: boolean;
}

export function RefineInput({ onRefine, isRefining }: RefineInputProps) {
  const [instruction, setInstruction] = useState("");

  const handleSubmit = async () => {
    if (!instruction.trim() || isRefining) return;
    await onRefine(instruction.trim());
    setInstruction("");
  };

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="Describe how you'd like to refine this prompt..."
        className="min-h-[80px] text-sm resize-none"
        disabled={isRefining}
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!instruction.trim() || isRefining}
        >
          {isRefining ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Refining...
            </>
          ) : (
            "Refine"
          )}
        </Button>
      </div>
    </div>
  );
}
