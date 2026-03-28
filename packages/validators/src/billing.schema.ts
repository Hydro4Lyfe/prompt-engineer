import { z } from "zod";

export const CheckoutInput = z.object({
  tier: z.enum(["PRO", "TEAM"]),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});
export type CheckoutInput = z.infer<typeof CheckoutInput>;

export const CheckoutResponse = z.object({
  checkoutUrl: z.string().url(),
});
export type CheckoutResponse = z.infer<typeof CheckoutResponse>;

export const PortalResponse = z.object({
  portalUrl: z.string().url(),
});
export type PortalResponse = z.infer<typeof PortalResponse>;
