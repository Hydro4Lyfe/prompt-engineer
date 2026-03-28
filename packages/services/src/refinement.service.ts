import { getModelProvider, safeJsonParse } from "@prompt-engineer/ai";
import {
  buildRefinementPrompt,
  buildSynthesisPrompt,
} from "@prompt-engineer/prompts";
import type {
  RefineResponse,
  SynthesisResponse,
  PromptVersion,
  SteeringInputs,
  ClarificationQuestion,
} from "@prompt-engineer/validators";
import { SessionService } from "./session.service";
import { ServiceError } from "./errors";

export class RefinementService {
  constructor(private sessions: SessionService) {}

  async refine(
    sessionId: string,
    currentPrompt: string,
    instruction: string,
    userId?: string
  ): Promise<RefineResponse> {
    const session = await this.sessions.getById(sessionId, userId);
    if (session.status !== "COMPLETED") {
      throw new ServiceError("SESSION_NOT_COMPLETED", 409);
    }

    const targetModel = session.targetModel as string | undefined;
    const provider = getModelProvider();
    const response = await provider.generate({
      systemPrompt: buildRefinementPrompt(targetModel),
      userMessage: `Current prompt:\n"${currentPrompt}"\n\nRefinement instruction:\n"${instruction}"`,
      temperature: 0.6,
      maxTokens: 3000,
      responseFormat: "json",
    });

    const result = safeJsonParse<{ finalPrompt: string; description: string }>(
      response.content
    );
    if (!result) {
      throw new ServiceError("MODEL_INVALID_RESPONSE", 500);
    }

    const versions = ((session.versions as PromptVersion[]) ?? []).slice();
    const newVersion: PromptVersion = {
      id: crypto.randomUUID(),
      prompt: result.finalPrompt,
      trigger: "refine",
      description: result.description,
      createdAt: new Date().toISOString(),
    };
    versions.push(newVersion);

    await this.sessions.updateData(sessionId, {
      finalPrompt: result.finalPrompt,
      versions,
    });

    return {
      finalPrompt: result.finalPrompt,
      description: result.description,
    };
  }

  async regenerate(
    sessionId: string,
    steeringInputs: SteeringInputs,
    userId?: string
  ): Promise<SynthesisResponse> {
    const session = await this.sessions.getById(sessionId, userId);
    if (session.status !== "COMPLETED") {
      throw new ServiceError("SESSION_NOT_COMPLETED", 409);
    }

    const targetModel = session.targetModel as string | undefined;
    const questions = (session.questions as ClarificationQuestion[]) ?? [];
    const answers =
      (session.answers as Record<string, string | null>) ?? {};

    try {
      await this.sessions.transitionTo(sessionId, "GENERATING");

      const qaContext = questions
        .map((q) => {
          const answer = answers[q.id];
          const effective = answer ?? `${q.default} (default)`;
          return `Q: ${q.question}\nA: ${effective}`;
        })
        .join("\n\n");

      const steeringContext = buildSteeringContext(steeringInputs);

      const userMessage = [
        `Original rough prompt:\n"${session.rawPrompt}"`,
        qaContext ? `\nClarification Q&A:\n${qaContext}` : "",
        steeringContext
          ? `\nSteering preferences:\n${steeringContext}`
          : "",
        `\nGenerate the optimized prompt.`,
      ]
        .filter(Boolean)
        .join("\n");

      const provider = getModelProvider();
      const response = await provider.generate({
        systemPrompt: buildSynthesisPrompt(targetModel),
        userMessage,
        temperature: 0.6,
        maxTokens: 3000,
        responseFormat: "json",
      });

      const result = safeJsonParse<{
        finalPrompt: string;
        changelog: string[];
        tips?: string[];
      }>(response.content);
      if (!result) {
        throw new ServiceError("MODEL_INVALID_RESPONSE", 500);
      }

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

      const versions = ((session.versions as PromptVersion[]) ?? []).slice();
      const newVersion: PromptVersion = {
        id: crypto.randomUUID(),
        prompt: result.finalPrompt,
        changelog: result.changelog,
        tips: result.tips,
        trigger: "regenerate",
        description: "Regenerated with adjusted steering",
        createdAt: new Date().toISOString(),
      };
      versions.push(newVersion);

      await this.sessions.transitionTo(sessionId, "COMPLETED", {
        finalPrompt: result.finalPrompt,
        changelog: result.changelog,
        steeringInputs,
        versions,
        tokensUsed: response.tokensUsed.total,
        modelUsed: response.model,
      });

      return synthesisResponse;
    } catch (error) {
      await this.sessions.transitionTo(sessionId, "FAILED").catch(() => {});
      throw error;
    }
  }
}

function buildSteeringContext(inputs: SteeringInputs): string {
  const lines: string[] = [];

  const toneLabel =
    inputs.tone < 40 ? "formal" : inputs.tone > 60 ? "casual" : "neutral";
  lines.push(`- Tone: ${inputs.tone}/100 (${toneLabel})`);

  const detailLabel =
    inputs.detailLevel < 40
      ? "concise"
      : inputs.detailLevel > 60
        ? "thorough"
        : "moderate";
  lines.push(`- Detail Level: ${inputs.detailLevel}/100 (${detailLabel})`);

  if (inputs.categoryDials) {
    for (const [key, value] of Object.entries(inputs.categoryDials)) {
      lines.push(`- ${key}: ${value}`);
    }
  }

  return lines.join("\n");
}
