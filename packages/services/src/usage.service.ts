import { prisma } from "@prompt-engineer/db";
import { TIERS, type TierName, type TierLimits } from "./tier";
import { ServiceError } from "./errors";

export class UsageService {
  async getUserTier(userId: string): Promise<TierName> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true },
    });
    return (user?.tier as TierName) ?? "FREE";
  }

  async getLimitsForUser(userId: string): Promise<TierLimits> {
    const tier = await this.getUserTier(userId);
    return TIERS[tier];
  }

  async checkLimits(userId: string): Promise<void> {
    const tier = await this.getUserTier(userId);
    const limits = TIERS[tier];
    const usage = await this.getOrCreate(userId);

    // Reset daily counter if new day
    const today = new Date().toISOString().slice(0, 10);
    const lastReset = usage.lastResetDate.toISOString().slice(0, 10);
    if (today !== lastReset) {
      await prisma.usage.update({
        where: { userId },
        data: {
          tokensUsedToday: 0,
          sessionsToday: 0,
          lastResetDate: new Date(),
        },
      });
      return;
    }

    if (
      limits.dailySessions !== -1 &&
      usage.sessionsToday >= limits.dailySessions
    ) {
      throw new ServiceError(
        "TIER_LIMIT_EXCEEDED",
        429,
        tier === "FREE"
          ? "Free tier limit reached. Upgrade to Pro for unlimited sessions."
          : "Daily session limit reached."
      );
    }
    if (
      limits.monthlySessions !== -1 &&
      usage.sessionsMonth >= limits.monthlySessions
    ) {
      throw new ServiceError(
        "TIER_LIMIT_EXCEEDED",
        429,
        tier === "FREE"
          ? "Monthly limit reached. Upgrade to Pro for unlimited sessions."
          : "Monthly session limit reached."
      );
    }

    if (usage.tokensUsedToday >= limits.dailyTokens) {
      throw new ServiceError(
        "TIER_LIMIT_EXCEEDED",
        429,
        "Daily token limit reached."
      );
    }
    if (usage.tokensUsedMonth >= limits.monthlyTokens) {
      throw new ServiceError(
        "TIER_LIMIT_EXCEEDED",
        429,
        "Monthly token limit reached."
      );
    }
  }

  async requireFeature(
    userId: string,
    feature: keyof TierLimits
  ): Promise<void> {
    const limits = await this.getLimitsForUser(userId);
    const value = limits[feature];
    if (value === false) {
      throw new ServiceError(
        "FEATURE_NOT_AVAILABLE",
        403,
        "This feature requires a Pro subscription."
      );
    }
  }

  async recordSession(userId: string, tokens: number): Promise<void> {
    await this.getOrCreate(userId);
    await prisma.usage.update({
      where: { userId },
      data: {
        tokensUsedToday: { increment: tokens },
        tokensUsedMonth: { increment: tokens },
        sessionsToday: { increment: 1 },
        sessionsMonth: { increment: 1 },
      },
    });
  }

  async recordTokens(userId: string, tokens: number): Promise<void> {
    await this.getOrCreate(userId);
    await prisma.usage.update({
      where: { userId },
      data: {
        tokensUsedToday: { increment: tokens },
        tokensUsedMonth: { increment: tokens },
      },
    });
  }

  async getStats(userId: string) {
    const [tier, usage, user] = await Promise.all([
      this.getUserTier(userId),
      this.getOrCreate(userId),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          stripePeriodEnd: true,
        },
      }),
    ]);
    const limits = TIERS[tier];

    return {
      tier,
      tokensUsedToday: usage.tokensUsedToday,
      tokensUsedMonth: usage.tokensUsedMonth,
      sessionsToday: usage.sessionsToday,
      sessionsMonth: usage.sessionsMonth,
      limits: {
        dailySessions: limits.dailySessions,
        monthlySessions: limits.monthlySessions,
        dailyTokens: limits.dailyTokens,
        monthlyTokens: limits.monthlyTokens,
        detailedMode: limits.detailedMode,
        history: limits.history !== false,
      },
      stripe: {
        customerId: user?.stripeCustomerId ?? null,
        subscriptionId: user?.stripeSubscriptionId ?? null,
        currentPeriodEnd: user?.stripePeriodEnd?.toISOString() ?? null,
      },
    };
  }

  private async getOrCreate(userId: string) {
    return prisma.usage.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }
}
