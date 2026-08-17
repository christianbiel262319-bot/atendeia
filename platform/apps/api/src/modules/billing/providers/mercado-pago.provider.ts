import { z } from "zod";
import { env } from "../../../config/env.js";
import { AppError } from "../../../core/errors/app-error.js";
import { providerRequest } from "./provider-http.js";
import type { BillingProviderAdapter, CheckoutRequest, CheckoutResult } from "./provider.types.js";

const preapprovalSchema = z.object({ id: z.string().min(1), init_point: z.url() });

export class MercadoPagoProvider implements BillingProviderAdapter {
  async createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
    if (!env.MERCADO_PAGO_ACCESS_TOKEN) {
      throw new AppError(503, "PROVIDER_NOT_CONFIGURED", "Mercado Pago ainda não foi configurado");
    }
    const response = preapprovalSchema.parse(
      await providerRequest<unknown>("Mercado Pago", "https://api.mercadopago.com/preapproval", {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
          "content-type": "application/json",
          "x-idempotency-key": input.idempotencyKey,
        },
        body: JSON.stringify({
          reason: input.plan.name,
          payer_email: input.customer.email,
          external_reference: `${input.tenantId}:${input.plan.id}`,
          back_url: `${env.APP_ORIGIN}/planos?checkout=sucesso`,
          status: "pending",
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: input.plan.monthlyPrice,
            currency_id: input.plan.currency,
          },
        }),
      }),
    );
    return { provider: "MERCADO_PAGO", externalId: response.id, redirectUrl: response.init_point };
  }

  async cancel(externalId: string): Promise<void> {
    if (!env.MERCADO_PAGO_ACCESS_TOKEN) {
      throw new AppError(503, "PROVIDER_NOT_CONFIGURED", "Mercado Pago ainda não foi configurado");
    }
    await providerRequest<unknown>(
      "Mercado Pago",
      `https://api.mercadopago.com/preapproval/${encodeURIComponent(externalId)}`,
      {
        method: "PUT",
        headers: { authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      },
    );
  }
}
