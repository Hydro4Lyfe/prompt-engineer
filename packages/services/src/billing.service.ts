import Stripe from "stripe";
import { prisma } from "@prompt-engineer/db";
import { STRIPE_PRICE_IDS, type TierName } from "./tier";
import { ServiceError } from "./errors";

function getStripeClient(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-04-30.basil",
  });
}

export class BillingService {
  async createCheckout(
    userId: string,
    tier: "PRO" | "TEAM",
    successUrl: string,
    cancelUrl: string
  ): Promise<{ checkoutUrl: string }> {
    const stripe = getStripeClient();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, tier: true, stripeCustomerId: true },
    });
    if (!user) throw new ServiceError("SESSION_NOT_FOUND", 404);
    if (user.tier === tier) {
      throw new ServiceError(
        "INVALID_TRANSITION",
        400,
        `Already on ${tier} tier.`
      );
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: STRIPE_PRICE_IDS[tier], quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId, tier },
    });

    return { checkoutUrl: session.url! };
  }

  async createPortalSession(userId: string): Promise<{ portalUrl: string }> {
    const stripe = getStripeClient();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) {
      throw new ServiceError(
        "SESSION_NOT_FOUND",
        404,
        "No active subscription."
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXTAUTH_URL}/settings`,
    });

    return { portalUrl: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    switch (event.type) {
      case "checkout.session.completed":
        await this.onCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "customer.subscription.updated":
        await this.onSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        );
        break;
      case "customer.subscription.deleted":
        await this.onSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;
      case "invoice.payment_failed":
        await this.onPaymentFailed(event.data.object as Stripe.Invoice);
        break;
    }
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session) {
    const stripe = getStripeClient();
    const userId = session.metadata?.userId;
    const tier = session.metadata?.tier as TierName;
    if (!userId || !tier) return;

    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );

    await prisma.user.update({
      where: { id: userId },
      data: {
        tier,
        stripeSubscriptionId: subscription.id,
        stripePeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });
  }

  private async onSubscriptionUpdated(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!user) return;

    const priceId = subscription.items.data[0]?.price.id;
    const tier = this.priceIdToTier(priceId);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        tier,
        stripeSubscriptionId: subscription.id,
        stripePeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });
  }

  private async onSubscriptionDeleted(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    await prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: {
        tier: "FREE",
        stripeSubscriptionId: null,
        stripePeriodEnd: null,
      },
    });
  }

  private async onPaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    console.warn(`Payment failed for customer ${customerId}`, {
      invoiceId: invoice.id,
      attemptCount: invoice.attempt_count,
    });
  }

  private priceIdToTier(priceId: string): TierName {
    for (const [tier, id] of Object.entries(STRIPE_PRICE_IDS)) {
      if (id === priceId) return tier as TierName;
    }
    return "FREE";
  }
}
