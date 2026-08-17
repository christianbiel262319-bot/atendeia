import { z } from "zod";
import { env } from "../../../config/env.js";
import { AppError } from "../../../core/errors/app-error.js";
import { providerRequest } from "./provider-http.js";
import type { BillingProviderAdapter, CheckoutRequest, CheckoutResult } from "./provider.types.js";

const customerSchema = z.object({ id: z.string().min(1) });
const subscriptionSchema = z.object({ id: z.string().min(1) });
const paymentsSchema = z.object({
  data: z.array(z.object({ invoiceUrl: z.url().optional(), bankSlipUrl: z.url().optional() })).default([]),
});

export class AsaasProvider implements BillingProviderAdapter {
  async createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
    if (!env.ASAAS_API_KEY) {
      throw new AppError(503, "PROVIDER_NOT_CONFIGURED", "Asaas ainda não foi configurado");
    }
    const headers = {
      access_token: env.ASAAS_API_KEY,
      "content-type": "application/json",
      "user-agent": "AtendeIA/1.0",
    };
    const customer = customerSchema.parse(
      await providerRequest<unknown>("Asaas", `${env.ASAAS_API_URL}/customers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: input.customer.name,
          email: input.customer.email,
          ...(input.customer.taxId ? { cpfCnpj: input.customer.taxId } : {}),
          externalReference: input.tenantId,
        }),
      }),
    );
    const subscription = subscriptionSchema.parse(
      await providerRequest<unknown>("Asaas", `${env.ASAAS_API_URL}/subscriptions`, {
        method: "POST",
        headers: { ...headers, "x-idempotency-key": input.idempotencyKey },
        body: JSON.stringify({
          customer: customer.id,
          billingType: "UNDEFINED",
          value: input.plan.monthlyPrice,
          nextDueDate: isoDateTomorrow(),
          cycle: "MONTHLY",
          description: input.plan.name,
          externalReference: `${input.tenantId}:${input.plan.id}`,
        }),
      }),
    );
    const payments = paymentsSchema.parse(
      await providerRequest<unknown>(
        "Asaas",
        `${env.ASAAS_API_URL}/subscriptions/${encodeURIComponent(subscription.id)}/payments?limit=1`,
        { method: "GET", headers },
      ),
    );
    const first = payments.data[0];
    const redirectUrl = first?.invoiceUrl ?? first?.bankSlipUrl;
    if (!redirectUrl) {
      throw new AppError(502, "BILLING_PROVIDER_ERROR", "O Asaas não retornou a cobrança inicial");
    }
    return { provider: "ASAAS", externalId: subscription.id, redirectUrl };
  }

  async cancel(externalId: string): Promise<void> {
    if (!env.ASAAS_API_KEY) {
      throw new AppError(503, "PROVIDER_NOT_CONFIGURED", "Asaas ainda não foi configurado");
    }
    await providerRequest<unknown>(
      "Asaas",
      `${env.ASAAS_API_URL}/subscriptions/${encodeURIComponent(externalId)}`,
      { method: "DELETE", headers: { access_token: env.ASAAS_API_KEY, "user-agent": "AtendeIA/1.0" } },
    );
  }
}

function isoDateTomorrow(): string {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1_000);
  return date.toISOString().slice(0, 10);
}
