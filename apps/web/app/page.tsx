"use client";

import { useState } from "react";
import { useAnonymousId } from "@/lib/hooks/use-anonymous-id";
import { useSessionFlow } from "@/lib/hooks/use-session-flow";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { PromptInput } from "@/components/prompt-input";
import { ClarificationQuestions } from "@/components/clarification-questions";
import { PromptResult } from "@/components/prompt-result";

export default function Home() {
  const anonymousId = useAnonymousId();
  const flow = useSessionFlow(anonymousId);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen">
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          anonymousId={anonymousId}
          activeSessionId={flow.sessionId}
          onSelectSession={flow.loadSession}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-6 py-10">
            {flow.step === "input" && (
              <PromptInput
                rawPrompt={flow.rawPrompt}
                onRawPromptChange={flow.setRawPrompt}
                targetModel={flow.targetModel}
                onTargetModelChange={flow.setTargetModel}
                steeringInputs={flow.steeringInputs}
                onSteeringInputsChange={flow.setSteeringInputs}
                mode={flow.mode}
                onModeChange={flow.setMode}
                onSubmit={flow.analyze}
                isLoading={flow.isLoading}
                error={flow.error}
              />
            )}

            {flow.step === "questions" && flow.analysisResult && (
              <ClarificationQuestions
                rawPrompt={flow.rawPrompt}
                category={flow.analysisResult.category}
                targetModel={flow.targetModel}
                questions={flow.analysisResult.questions}
                answers={flow.answers}
                onAnswerChange={flow.setAnswer}
                onSubmit={flow.submitAnswers}
                onBack={flow.goBack}
                isLoading={flow.isLoading}
                error={flow.error}
              />
            )}

            {flow.step === "result" && flow.synthesisResult && (
              <PromptResult
                rawPrompt={flow.rawPrompt}
                category={flow.analysisResult?.category ?? null}
                targetModel={flow.targetModel}
                result={flow.synthesisResult}
                onBack={flow.goBack}
                onStartOver={flow.startOver}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
