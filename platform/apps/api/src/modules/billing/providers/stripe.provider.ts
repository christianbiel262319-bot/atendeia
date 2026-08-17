import { z } from "zod";
import { env } from "../../../config/env.js";
import { AppError } from "../../../core/errors/app-error.js";
import { providerRequest } from "./provider-http.js";
import type { BillingProviderAdapter, CheckoutRequest, CheckoutResult } from "./provider.types.js";

const stripeCheckoutSchema = z.object({ id: z.string().min(1), url: z.url() });

export class StripeProvider implements BillingProviderAdapter {
  async createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
    if (!env.STRIPE_SECRET_KEY) {
      throw new AppError(503, "PROVIDER_NOT_CONFIGURED", "Stripe ainda não foi configurado");
    }
    const body = new URLSearchParams({
      mode: "subscription",
      success_url: `${env.APP_ORIGIN}/planos?checkout=sucesso`,
      cancel_url: `${env.APP_ORIGIN}/planos?checkout=cancelado`,
      customer_email: input.customer.email,
      client_reference_id: input.tenantId,
      "metadata[tenantId]": input.tenantId,
      "metadata[planId]": input.plan.id,
      "subscription_data[metadata][tenantId]": input.tenantId,
      "subscription_data[metadata][planId]": input.plan.id,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": input.plan.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(Math.round(input.plan.monthlyPrice * 100)),
      "line_items[0][price_data][recurring][interval]": "month",
      "line_items[0][price_data][product_data][name]": input.plan.name,
    });
    const response = stripeCheckoutSchema.parse(
      await providerRequest<unknown>("Stripe", "https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          "content-type": "application/x-www-form-urlencoded",
          "idempotency-key": input.idempotencyKey,
        },
        body,
      }),
    );
    return { provider: "STRIPE", externalId: response.id, redirectUrl: response.url };
  }

  async cancel(externalId: string): Promise<void> {
    if (!env.STRIPE_SECRET_KEY) {
      throw new AppError(503, "PROVIDER_NOT_CONFIGURED", "Stripe ainda não foi configurado");
    }
    const checkoutPending = externalId.startsWith("cs_");
    await providerRequest<unknown>(
      "Stripe",
      checkoutPending
        ? `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(externalId)}/expire`
        : `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(externalId)}`,
      {
        method: checkoutPending ? "POST" : "DELETE",
        headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
      },
    );
  }
}
