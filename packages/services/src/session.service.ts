import { prisma } from "@prompt-engineer/db";
import { ServiceError } from "./errors";

const VALID_TRANSITIONS: Record<string, string[]> = {
  CREATED: ["ANALYZING"],
  ANALYZING: ["QUESTIONS_READY", "FAILED"],
  QUESTIONS_READY: ["ANSWERS_SUBMITTED"],
  ANSWERS_SUBMITTED: ["GENERATING"],
  GENERATING: ["COMPLETED", "FAILED"],
  COMPLETED: ["GENERATING"],
  FAILED: ["ANALYZING"],
};

export class SessionService {
  async create(userId?: string, anonymousId?: string): Promise<{ id: string }> {
    const session = await prisma.promptSession.create({
      data: {
        rawPrompt: "",
        mode: "QUICK",
        status: "CREATED",
        ...(userId && { userId }),
        ...(anonymousId && !userId && { anonymousId }),
      },
      select: { id: true },
    });
    return session;
  }

  async getById(id: string, userId?: string, anonymousId?: string) {
    const session = await prisma.promptSession.findUnique({
      where: { id },
    });
    if (!session) throw new ServiceError("SESSION_NOT_FOUND", 404);
    if (userId && session.userId && session.userId !== userId) {
      throw new ServiceError("FORBIDDEN", 403);
    }
    if (anonymousId && session.anonymousId && session.anonymousId !== anonymousId) {
      throw new ServiceError("FORBIDDEN", 403);
    }
    return session;
  }

  async list(userId: string, cursor?: string, limit = 20) {
    const sessions = await prisma.promptSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: {
        id: true,
        rawPrompt: true,
        status: true,
        category: true,
        createdAt: true,
      },
    });

    const hasMore = sessions.length > limit;
    const items = hasMore ? sessions.slice(0, -1) : sessions;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return { sessions: items, nextCursor };
  }

  async listByAnonymousId(anonymousId: string, cursor?: string, limit = 20) {
    const sessions = await prisma.promptSession.findMany({
      where: { anonymousId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: {
        id: true,
        rawPrompt: true,
        status: true,
        category: true,
        createdAt: true,
        finalPrompt: true,
      },
    });

    const hasMore = sessions.length > limit;
    const items = hasMore ? sessions.slice(0, -1) : sessions;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return { sessions: items, nextCursor };
  }

  async transitionTo(
    id: string,
    status: string,
    data?: Record<string, unknown>
  ) {
    const session = await prisma.promptSession.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!session) throw new ServiceError("SESSION_NOT_FOUND", 404);

    const allowed = VALID_TRANSITIONS[session.status];
    if (!allowed?.includes(status)) {
      throw new ServiceError(
        "INVALID_TRANSITION",
        409,
        `Cannot transition from ${session.status} to ${status}`
      );
    }

    return prisma.promptSession.update({
      where: { id },
      data: { status: status as any, ...data },
    });
  }

  async delete(id: string, userId: string) {
    const session = await this.getById(id, userId);
    await prisma.promptSession.delete({ where: { id: session.id } });
  }
}
