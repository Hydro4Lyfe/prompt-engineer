import { getModelProvider, safeJsonParse } from "@prompt-engineer/ai";
import { buildAnalysisPrompt } from "@prompt-engineer/prompts";
import type { AnalysisResponse, PromptMode } from "@prompt-engineer/validators";
import { SessionService } from "./session.service";
import { UsageService } from "./usage.service";
import { ServiceError } from "./errors";

export class AnalysisService {
  constructor(
    private sessions: SessionService,
    private usage: UsageService
  ) {}

  async analyze(
    sessionId: string,
    rawPrompt: string,
    mode?: PromptMode,
    userId?: string
  ): Promise<AnalysisResponse> {
    // 1. Check rate limits and tier
    if (userId) {
      await this.usage.checkLimits(userId);
      if (mode === "detailed") {
        await this.usage.requireFeature(userId, "detailedMode");
      }
    } else {
      mode = "quick";
    }

    // 2. Transition session to ANALYZING
    await this.sessions.transitionTo(sessionId, "ANALYZING", { rawPrompt });

    try {
      // 3. Call model
      const provider = getModelProvider();
      const systemPrompt = buildAnalysisPrompt();
      const response = await provider.generate({
        systemPrompt,
        userMessage: rawPrompt,
        temperature: 0.4,
        responseFormat: "json",
      });

      // 4. Parse and validate response
      const result = safeJsonParse<AnalysisResponse>(response.content);
      if (!result) {
        throw new ServiceError("MODEL_INVALID_RESPONSE", 500);
      }

      // 5. Filter questions by mode
      const effectiveMode = mode ?? result.suggestedMode;
      const maxQuestions = effectiveMode === "quick" ? 3 : 6;
      result.questions = result.questions
        .sort((a, b) => a.priority - b.priority)
        .slice(0, maxQuestions);

      // 6. Persist results and transition to QUESTIONS_READY
      await this.sessions.transitionTo(sessionId, "QUESTIONS_READY", {
        intent: result.intent,
        category: result.category,
        detectedElements: result.detectedElements,
        missingElements: result.missingElements,
        questions: result.questions,
        mode: effectiveMode === "quick" ? "QUICK" : "DETAILED",
      });

      // 7. Track usage (session count + tokens)
      if (userId) {
        await this.usage.recordSession(userId, response.tokensUsed.total);
      }

      return result;
    } catch (error) {
      await this.sessions.transitionTo(sessionId, "FAILED").catch(() => {});
      throw error;
    }
  }
}
