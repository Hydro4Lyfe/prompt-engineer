"use client";

import { useState, useCallback } from "react";
import type {
  AnalysisResponse,
  SynthesisResponse,
  SteeringInputs,
  TargetModel,
  PromptMode,
  ClarificationQuestion,
  PromptVersion,
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

  isRefining: boolean;
  // Version tracking
  versions: PromptVersion[];
  activeVersionIndex: number;
  appliedTips: string[];
  originalSteeringInputs: SteeringInputs;
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
  isRefining: false,
  versions: [],
  activeVersionIndex: 0,
  appliedTips: [],
  originalSteeringInputs: initialSteeringInputs,
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

      // Note: The server also creates an initial version in SynthesisService.
      // This client-side version mirrors it for immediate local state. Subsequent
      // operations (tip apply, refine, regenerate) overwrite the server's versions
      // array, so the two stay in sync.
      const initialVersion: PromptVersion = {
        id: crypto.randomUUID(),
        prompt: synthesisResult.finalPrompt,
        changelog: synthesisResult.changelog,
        tips: synthesisResult.tips,
        trigger: "synthesis",
        description: "Initial generation",
        createdAt: new Date().toISOString(),
      };

      setState((s) => ({
        ...s,
        synthesisResult,
        versions: [initialVersion],
        activeVersionIndex: 0,
        appliedTips: [],
        originalSteeringInputs: { ...s.steeringInputs },
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

  const applyTip = useCallback(
    (tipText: string) => {
      setState((s) => {
        const currentPrompt =
          s.versions[s.activeVersionIndex]?.prompt ??
          s.synthesisResult?.finalPrompt ??
          "";
        const updatedPrompt = `${currentPrompt}\n\nAdditional constraint: ${tipText}`;

        const newVersion: PromptVersion = {
          id: crypto.randomUUID(),
          prompt: updatedPrompt,
          trigger: "tip",
          description: `Applied: ${tipText}`,
          createdAt: new Date().toISOString(),
        };

        const newVersions = [...s.versions, newVersion];
        const newIndex = newVersions.length - 1;

        // Fire-and-forget PATCH to persist versions (pass anonymousId for auth)
        if (s.sessionId) {
          const qs = anonymousId ? `?anonymousId=${anonymousId}` : "";
          fetch(`/api/sessions/${s.sessionId}/versions${qs}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ versions: newVersions }),
          }).catch(() => {});
        }

        return {
          ...s,
          versions: newVersions,
          activeVersionIndex: newIndex,
          appliedTips: [...s.appliedTips, tipText],
        };
      });
    },
    [anonymousId]
  );

  const refine = useCallback(
    async (instruction: string) => {
      if (!state.sessionId) return;

      const currentPrompt =
        state.versions[state.activeVersionIndex]?.prompt ??
        state.synthesisResult?.finalPrompt ??
        "";

      setState((s) => ({ ...s, isRefining: true, error: null }));

      try {
        const res = await fetch(
          `/api/sessions/${state.sessionId}/refine`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPrompt, instruction }),
          }
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Refinement failed");
        }
        const result = await res.json();

        const newVersion: PromptVersion = {
          id: crypto.randomUUID(),
          prompt: result.finalPrompt,
          trigger: "refine",
          description: result.description,
          createdAt: new Date().toISOString(),
        };

        setState((s) => ({
          ...s,
          versions: [...s.versions, newVersion],
          activeVersionIndex: s.versions.length,
          isRefining: false,
        }));
      } catch (error: any) {
        setState((s) => ({
          ...s,
          isRefining: false,
          error: error.message ?? "Refinement failed",
        }));
      }
    },
    [state.sessionId, state.versions, state.activeVersionIndex, state.synthesisResult]
  );

  const regenerateWithSteering = useCallback(async () => {
    if (!state.sessionId) return;

    setState((s) => ({ ...s, isRefining: true, error: null }));

    try {
      const res = await fetch(
        `/api/sessions/${state.sessionId}/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ steeringInputs: state.steeringInputs }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Regeneration failed");
      }
      const synthesisResult: SynthesisResponse = await res.json();

      const newVersion: PromptVersion = {
        id: crypto.randomUUID(),
        prompt: synthesisResult.finalPrompt,
        changelog: synthesisResult.changelog,
        tips: synthesisResult.tips,
        trigger: "regenerate",
        description: "Regenerated with adjusted steering",
        createdAt: new Date().toISOString(),
      };

      setState((s) => ({
        ...s,
        synthesisResult,
        versions: [...s.versions, newVersion],
        activeVersionIndex: s.versions.length,
        appliedTips: [],
        originalSteeringInputs: { ...s.steeringInputs },
        isRefining: false,
      }));
    } catch (error: any) {
      setState((s) => ({
        ...s,
        isRefining: false,
        error: error.message ?? "Regeneration failed",
      }));
    }
  }, [state.sessionId, state.steeringInputs]);

  const navigateToVersion = useCallback((index: number) => {
    setState((s) => ({
      ...s,
      activeVersionIndex: Math.max(0, Math.min(index, s.versions.length - 1)),
    }));
  }, []);

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

  const loadSession = useCallback(
    async (sessionId: string) => {
      if (!anonymousId) return;

      setState((s) => ({ ...s, isLoading: true, error: null }));

      try {
        const res = await fetch(
          `/api/sessions/${sessionId}?anonymousId=${anonymousId}`
        );
        if (!res.ok) throw new Error("Failed to load session");
        const session = await res.json();

        if (session.status === "COMPLETED" && session.finalPrompt) {
          const versions: PromptVersion[] = session.versions ?? [];
          const restoredSteering: SteeringInputs = session.steeringInputs ?? {
            tone: 50,
            detailLevel: 50,
          };
          const restoredTargetModel: TargetModel =
            session.targetModel ?? "claude";

          // Derive applied tips from version history
          const appliedTips = versions
            .filter((v: PromptVersion) => v.trigger === "tip")
            .map((v: PromptVersion) => v.description.replace("Applied: ", ""));

          setState((s) => ({
            ...s,
            sessionId,
            rawPrompt: session.rawPrompt ?? "",
            targetModel: restoredTargetModel,
            steeringInputs: restoredSteering,
            originalSteeringInputs: restoredSteering,
            synthesisResult: {
              finalPrompt: session.finalPrompt,
              changelog: session.changelog ?? [],
              tips: versions.length > 0 ? versions[0].tips : undefined,
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
                  suggestedMode:
                    session.mode === "DETAILED" ? "detailed" : "quick",
                  detectedElements: session.detectedElements ?? [],
                  missingElements: [],
                  questions: session.questions,
                }
              : null,
            versions,
            activeVersionIndex: Math.max(0, versions.length - 1),
            appliedTips,
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
    },
    [anonymousId]
  );

  // Derive current tips from the most recent version that has them
  const currentTips = (() => {
    for (let i = state.versions.length - 1; i >= 0; i--) {
      if (state.versions[i].tips?.length) return state.versions[i].tips!;
    }
    return state.synthesisResult?.tips ?? [];
  })();

  const steeringDirty =
    JSON.stringify(state.steeringInputs) !==
    JSON.stringify(state.originalSteeringInputs);

  return {
    ...state,
    currentTips,
    steeringDirty,
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
    applyTip,
    refine,
    regenerateWithSteering,
    navigateToVersion,
  };
}
