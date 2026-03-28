export type TierName = "FREE" | "PRO" | "TEAM";

export interface TierLimits {
  dailySessions: number; // -1 = unlimited
  monthlySessions: number;
  dailyTokens: number;
  monthlyTokens: number;
  detailedMode: boolean;
  regenerate: boolean;
  history: boolean | number; // true = unlimited, number = max entries
  inlineEdit: boolean;
}

export const TIERS: Record<TierName, TierLimits> = {
  FREE: {
    dailySessions: 5,
    monthlySessions: 50,
    dailyTokens: 12_500,
    monthlyTokens: 125_000,
    detailedMode: false,
    regenerate: false,
    history: 10,
    inlineEdit: false,
  },
  PRO: {
    dailySessions: -1,
    monthlySessions: -1,
    dailyTokens: 200_000,
    monthlyTokens: 5_000_000,
    detailedMode: true,
    regenerate: true,
    history: true,
    inlineEdit: true,
  },
  TEAM: {
    dailySessions: -1,
    monthlySessions: -1,
    dailyTokens: 200_000,
    monthlyTokens: 5_000_000,
    detailedMode: true,
    regenerate: true,
    history: true,
    inlineEdit: true,
  },
};

export const STRIPE_PRICE_IDS: Record<string, string> = {
  PRO: process.env.STRIPE_PRICE_PRO ?? "",
  TEAM: process.env.STRIPE_PRICE_TEAM ?? "",
};
