"use client";

import { useState, useCallback } from "react";
import type {
  AnalysisResponse,
  SynthesisResponse,
  SteeringInputs,
  TargetModel,
  PromptMode,
  ClarificationQuestion,
} from "@prompt-engineer/validators";

type FlowStep = "input" | "questions" | "result";

interface FlowState {
  step: FlowStep;
  sessionId: string | null;
  isLoading: boolean;
  error: string | null;

  // Screen 1 inputs
  rawPrompt: string;
  targetModel: TargetModel;
  steeringInputs: SteeringInputs;
  mode: PromptMode;

  // Screen 2 data
  analysisResult: AnalysisResponse | null;
  answers: Record<string, string | null>;

  // Screen 3 data
  synthesisResult: SynthesisResponse | null;
}

const initialSteeringInputs: SteeringInputs = {
  tone: 50,
  detailLevel: 50,
};

const initialState: FlowState = {
  step: "input",
  sessionId: null,
  isLoading: false,
  error: null,
  rawPrompt: "",
  targetModel: "claude",
  steeringInputs: initialSteeringInputs,
  mode: "quick",
  analysisResult: null,
  answers: {},
  synthesisResult: null,
};

export function useSessionFlow(anonymousId: string | null) {
  const [state, setState] = useState<FlowState>(initialState);

  const setRawPrompt = useCallback((rawPrompt: string) => {
    setState((s) => ({ ...s, rawPrompt }));
  }, []);

  const setTargetModel = useCallback((targetModel: TargetModel) => {
    setState((s) => ({ ...s, targetModel }));
  }, []);

  const setSteeringInputs = useCallback((steeringInputs: SteeringInputs) => {
    setState((s) => ({ ...s, steeringInputs }));
  }, []);

  const setMode = useCallback((mode: PromptMode) => {
    setState((s) => ({ ...s, mode }));
  }, []);

  const analyze = useCallback(async () => {
    if (!anonymousId || !state.rawPrompt.trim()) return;

    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      // 1. Create session
      const createRes = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonymousId }),
      });
      if (!createRes.ok) throw new Error("Failed to create session");
      const { id: sessionId } = await createRes.json();

      // 2. Analyze
      const analyzeRes = await fetch(`/api/sessions/${sessionId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawPrompt: state.rawPrompt,
          mode: state.mode,
          targetModel: state.targetModel,
          steeringInputs: state.steeringInputs,
        }),
      });
      if (!analyzeRes.ok) {
        const err = await analyzeRes.json();
        throw new Error(err.error ?? "Analysis failed");
      }
      const analysisResult: AnalysisResponse = await analyzeRes.json();

      // 3. Pre-fill answers with defaults
      const defaultAnswers: Record<string, string | null> = {};
      for (const q of analysisResult.questions) {
        defaultAnswers[q.id] = q.default;
      }

      setState((s) => ({
        ...s,
        sessionId,
        analysisResult,
        answers: defaultAnswers,
        step: "questions",
        isLoading: false,
      }));
    } catch (error: any) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: error.message ?? "Something went wrong",
      }));
    }
  }, [anonymousId, state.rawPrompt, state.mode, state.targetModel, state.steeringInputs]);

  const setAnswer = useCallback((questionId: string, value: string | null) => {
    setState((s) => ({
      ...s,
      answers: { ...s.answers, [questionId]: value },
    }));
  }, []);

  const submitAnswers = useCallback(async () => {
    if (!state.sessionId) return;

    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const res = await fetch(`/api/sessions/${state.sessionId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: state.answers }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Synthesis failed");
      }
      const synthesisResult: SynthesisResponse = await res.json();

      setState((s) => ({
        ...s,
        synthesisResult,
        step: "result",
        isLoading: false,
      }));
    } catch (error: any) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: error.message ?? "Something went wrong",
      }));
    }
  }, [state.sessionId, state.answers]);

  const goBack = useCallback(() => {
    setState((s) => {
      if (s.step === "questions") return { ...s, step: "input", error: null };
      if (s.step === "result") return { ...s, step: "questions", error: null };
      return s;
    });
  }, []);

  const startOver = useCallback(() => {
    setState(initialState);
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    if (!anonymousId) return;

    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const res = await fetch(
        `/api/sessions/${sessionId}?anonymousId=${anonymousId}`
      );
      if (!res.ok) throw new Error("Failed to load session");
      const session = await res.json();

      if (session.status === "COMPLETED" && session.finalPrompt) {
        setState((s) => ({
          ...s,
          sessionId,
          rawPrompt: session.rawPrompt ?? "",
          synthesisResult: {
            finalPrompt: session.finalPrompt,
            changelog: session.changelog ?? [],
            metadata: {
              category: session.category ?? "WRITING",
              tokensUsed: session.tokensUsed ?? 0,
              modelUsed: session.modelUsed ?? "",
            },
          },
          analysisResult: session.questions
            ? {
                intent: session.intent ?? "",
                category: session.category ?? "WRITING",
                suggestedMode: session.mode === "DETAILED" ? "detailed" : "quick",
                detectedElements: session.detectedElements ?? [],
                missingElements: [],
                questions: session.questions,
              }
            : null,
          step: "result",
          isLoading: false,
        }));
      }
    } catch (error: any) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: error.message ?? "Failed to load session",
      }));
    }
  }, [anonymousId]);

  return {
    ...state,
    setRawPrompt,
    setTargetModel,
    setSteeringInputs,
    setMode,
    analyze,
    setAnswer,
    submitAnswers,
    goBack,
    startOver,
    loadSession,
  };
}
