import { getModelProvider, safeJsonParse } from "@prompt-engineer/ai";
import { buildSynthesisPrompt } from "@prompt-engineer/prompts";
import type {
  SynthesisResponse,
  ClarificationQuestion,
} from "@prompt-engineer/validators";
import { SessionService } from "./session.service";
import { UsageService } from "./usage.service";
import { ServiceError } from "./errors";

export class SynthesisService {
  constructor(
    private sessions: SessionService,
    private usage: UsageService
  ) {}

  async synthesize(
    sessionId: string,
    answers: Record<string, string | null>,
    userId?: string
  ): Promise<SynthesisResponse> {
    // 1. Load session and validate state
    const session = await this.sessions.getById(sessionId, userId);
    const targetModel = (session as any).targetModel as string | undefined;
    const questions = session.questions as ClarificationQuestion[];
    if (!questions || !session.rawPrompt) {
      throw new ServiceError("SESSION_NOT_ANALYZED", 409);
    }

    // 2. Validate answer IDs match question IDs
    const questionIds = new Set(questions.map((q) => q.id));
    for (const key of Object.keys(answers)) {
      if (!questionIds.has(key)) {
        throw new ServiceError(
          "INVALID_ANSWER_ID",
          400,
          `Unknown question ID: ${key}`
        );
      }
    }

    // 3. Transition: ANSWERS_SUBMITTED → GENERATING
    await this.sessions.transitionTo(sessionId, "ANSWERS_SUBMITTED", {
      answers,
    });
    await this.sessions.transitionTo(sessionId, "GENERATING");

    try {
      // 4. Build Q&A context
      const qaContext = questions
        .map((q) => {
          const answer = answers[q.id];
          const effective = answer ?? `${q.default} (default)`;
          return `Q: ${q.question}\nA: ${effective}`;
        })
        .join("\n\n");

      const userMessage = [
        `Original rough prompt:\n"${session.rawPrompt}"`,
        `\nClarification Q&A:\n${qaContext}`,
        `\nGenerate the optimized prompt.`,
      ].join("\n");

      // 5. Call model
      const provider = getModelProvider();
      const response = await provider.generate({
        systemPrompt: buildSynthesisPrompt(targetModel),
        userMessage,
        temperature: 0.6,
        maxTokens: 3000,
        responseFormat: "json",
      });

      // 6. Parse response
      const result = safeJsonParse<{
        finalPrompt: string;
        changelog: string[];
        tips?: string[];
      }>(response.content);
      if (!result) {
        throw new ServiceError("MODEL_INVALID_RESPONSE", 500);
      }

      // 7. Build full response
      const synthesisResponse: SynthesisResponse = {
        finalPrompt: result.finalPrompt,
        changelog: result.changelog,
        tips: result.tips,
        metadata: {
          category: session.category!,
          tokensUsed: response.tokensUsed.total,
          modelUsed: response.model,
        },
      };

      // 8. Persist and complete
      const initialVersion = {
        id: crypto.randomUUID(),
        prompt: result.finalPrompt,
        changelog: result.changelog,
        tips: result.tips,
        trigger: "synthesis" as const,
        description: "Initial generation",
        createdAt: new Date().toISOString(),
      };

      await this.sessions.transitionTo(sessionId, "COMPLETED", {
        finalPrompt: result.finalPrompt,
        changelog: result.changelog,
        versions: [initialVersion],
        tokensUsed: response.tokensUsed.total,
        modelUsed: response.model,
      });

      if (userId) {
        await this.usage.recordTokens(userId, response.tokensUsed.total);
      }

      return synthesisResponse;
    } catch (error) {
      await this.sessions.transitionTo(sessionId, "FAILED").catch(() => {});
      throw error;
    }
  }

  async regenerate(
    sessionId: string,
    emphasis?: string,
    userId?: string
  ): Promise<SynthesisResponse> {
    // Regeneration is a PRO/TEAM feature
    if (userId) {
      await this.usage.requireFeature(userId, "regenerate");
      await this.usage.checkLimits(userId);
    } else {
      throw new ServiceError(
        "FEATURE_NOT_AVAILABLE",
        403,
        "Sign in and upgrade to Pro to regenerate prompts."
      );
    }

    const session = await this.sessions.getById(sessionId, userId);
    const targetModel = (session as any).targetModel as string | undefined;
    if (session.status !== "COMPLETED") {
      throw new ServiceError("SESSION_NOT_COMPLETED", 409);
    }

    const answers = session.answers as Record<string, string | null>;
    await this.sessions.transitionTo(sessionId, "GENERATING");

    const rawPrompt = emphasis
      ? `${session.rawPrompt}\n\nAdditional guidance: ${emphasis}`
      : session.rawPrompt;

    const questions = session.questions as ClarificationQuestion[];
    const qaContext = questions
      .map((q) => {
        const answer = answers[q.id];
        const effective = answer ?? `${q.default} (default)`;
        return `Q: ${q.question}\nA: ${effective}`;
      })
      .join("\n\n");

    const provider = getModelProvider();
    const response = await provider.generate({
      systemPrompt: buildSynthesisPrompt(targetModel),
      userMessage: `Original rough prompt:\n"${rawPrompt}"\n\nClarification Q&A:\n${qaContext}\n\nGenerate the optimized prompt. Use different phrasing than previous attempts.`,
      temperature: 0.8,
      maxTokens: 3000,
      responseFormat: "json",
    });

    const result = safeJsonParse<{
      finalPrompt: string;
      changelog: string[];
      tips?: string[];
    }>(response.content);
    if (!result) throw new ServiceError("MODEL_INVALID_RESPONSE", 500);

    const synthesisResponse: SynthesisResponse = {
      finalPrompt: result.finalPrompt,
      changelog: result.changelog,
      tips: result.tips,
      metadata: {
        category: session.category!,
        tokensUsed: response.tokensUsed.total,
        modelUsed: response.model,
      },
    };

    await this.sessions.transitionTo(sessionId, "COMPLETED", {
      finalPrompt: result.finalPrompt,
      changelog: result.changelog,
      tokensUsed: response.tokensUsed.total,
    });

    return synthesisResponse;
  }
}
