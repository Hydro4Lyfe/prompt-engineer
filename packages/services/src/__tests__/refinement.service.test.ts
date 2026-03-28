import { describe, it, expect, vi, beforeEach } from "vitest";
import { RefinementService } from "../refinement.service";
import type { SessionService } from "../session.service";

vi.mock("@prompt-engineer/ai", () => ({
  getModelProvider: vi.fn(),
  safeJsonParse: vi.fn(),
}));

vi.mock("@prompt-engineer/prompts", () => ({
  buildRefinementPrompt: vi.fn(() => "refinement system prompt"),
  buildSynthesisPrompt: vi.fn(() => "synthesis system prompt"),
}));

vi.mock("@prompt-engineer/db", () => ({
  prisma: {
    promptSession: {
      update: vi.fn(),
    },
  },
}));

import { getModelProvider, safeJsonParse } from "@prompt-engineer/ai";

describe("RefinementService", () => {
  let service: RefinementService;
  let mockSessions: {
    getById: ReturnType<typeof vi.fn>;
    transitionTo: ReturnType<typeof vi.fn>;
    updateData: ReturnType<typeof vi.fn>;
  };
  let mockProvider: { generate: ReturnType<typeof vi.fn> };

  const completedSession = {
    id: "session-1",
    status: "COMPLETED",
    rawPrompt: "Write a poem about cats",
    targetModel: "claude",
    questions: [
      { id: "q1", question: "What tone?", why: "tone matters", default: "playful", priority: 1, type: "text" },
    ],
    answers: { q1: "formal" },
    versions: [],
    category: "CREATIVE",
    steeringInputs: { tone: 50, detailLevel: 50 },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSessions = {
      getById: vi.fn().mockResolvedValue({ ...completedSession }),
      transitionTo: vi.fn().mockResolvedValue({}),
      updateData: vi.fn().mockResolvedValue({}),
    };

    mockProvider = {
      generate: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          finalPrompt: "Refined prompt text",
          description: "Made the prompt more concise",
        }),
        tokensUsed: { input: 100, output: 50, total: 150 },
        model: "claude-sonnet-4-6",
      }),
    };

    (getModelProvider as ReturnType<typeof vi.fn>).mockReturnValue(mockProvider);
    (safeJsonParse as ReturnType<typeof vi.fn>).mockImplementation(
      (raw: string) => {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      }
    );

    service = new RefinementService(mockSessions as unknown as SessionService);
  });

  describe("refine", () => {
    it("calls Claude with current prompt and instruction", async () => {
      const result = await service.refine(
        "session-1",
        "current prompt text",
        "make it shorter"
      );

      expect(mockProvider.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          userMessage: expect.stringContaining("current prompt text"),
        })
      );
      expect(mockProvider.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          userMessage: expect.stringContaining("make it shorter"),
        })
      );
      expect(result.finalPrompt).toBe("Refined prompt text");
      expect(result.description).toBe("Made the prompt more concise");
    });

    it("persists new version and updated finalPrompt", async () => {
      await service.refine("session-1", "current prompt", "instruction");

      expect(mockSessions.updateData).toHaveBeenCalledWith(
        "session-1",
        expect.objectContaining({
          finalPrompt: "Refined prompt text",
          versions: expect.arrayContaining([
            expect.objectContaining({
              trigger: "refine",
              prompt: "Refined prompt text",
              description: "Made the prompt more concise",
            }),
          ]),
        })
      );
    });

    it("throws if session is not COMPLETED", async () => {
      mockSessions.getById.mockResolvedValue({
        ...completedSession,
        status: "GENERATING",
      });

      await expect(
        service.refine("session-1", "prompt", "instruction")
      ).rejects.toThrow();
    });

    it("does NOT change session status", async () => {
      await service.refine("session-1", "prompt", "instruction");

      expect(mockSessions.transitionTo).not.toHaveBeenCalled();
    });
  });

  describe("regenerate", () => {
    beforeEach(() => {
      mockProvider.generate.mockResolvedValue({
        content: JSON.stringify({
          finalPrompt: "Regenerated prompt",
          changelog: ["Changed tone"],
          tips: ["Add examples"],
        }),
        tokensUsed: { input: 200, output: 100, total: 300 },
        model: "claude-sonnet-4-6",
      });
    });

    it("transitions through GENERATING state", async () => {
      await service.regenerate("session-1", { tone: 80, detailLevel: 30 });

      expect(mockSessions.transitionTo).toHaveBeenCalledWith(
        "session-1",
        "GENERATING"
      );
      expect(mockSessions.transitionTo).toHaveBeenCalledWith(
        "session-1",
        "COMPLETED",
        expect.objectContaining({ finalPrompt: "Regenerated prompt" })
      );
    });

    it("includes steering context in the user message", async () => {
      await service.regenerate("session-1", { tone: 80, detailLevel: 30 });

      expect(mockProvider.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          userMessage: expect.stringContaining("Tone: 80/100"),
        })
      );
    });

    it("returns SynthesisResponse with tips", async () => {
      const result = await service.regenerate("session-1", {
        tone: 80,
        detailLevel: 30,
      });

      expect(result.finalPrompt).toBe("Regenerated prompt");
      expect(result.changelog).toEqual(["Changed tone"]);
      expect(result.tips).toEqual(["Add examples"]);
    });

    it("appends version to existing versions array", async () => {
      mockSessions.getById.mockResolvedValue({
        ...completedSession,
        versions: [
          {
            id: "v1",
            prompt: "original",
            trigger: "synthesis",
            description: "Initial",
            createdAt: "2026-03-28T00:00:00.000Z",
          },
        ],
      });

      await service.regenerate("session-1", { tone: 80, detailLevel: 30 });

      const persistedVersions =
        mockSessions.transitionTo.mock.calls[1][2].versions;
      expect(persistedVersions).toHaveLength(2);
      expect(persistedVersions[1].trigger).toBe("regenerate");
    });
  });
});
