import type { Prisma } from "../../generated/prisma/client.js";
import type { PaymentProvider, SubscriptionStatus } from "../../generated/prisma/enums.js";
import { env } from "../../config/env.js";
import { AppError, unauthorized } from "../../core/errors/app-error.js";
import { constantTimeEqual, sha256 } from "../../core/security/crypto.js";
import { prisma } from "../../infra/database/prisma.js";
import { providerRequest } from "./providers/provider-http.js";
import { verifyMercadoPagoWebhook, verifyStripeWebhook } from "./webhook-security.js";

type JsonObject = Record<string, unknown>;
type ProviderSlug = "stripe" | "mercado-pago" | "asaas";

export class BillingWebhookService {
  async receive(input: {
    provider: ProviderSlug;
    rawBody: Buffer;
    signature?: string | undefined;
    requestId?: string | undefined;
    dataId?: string | undefined;
    asaasToken?: string | undefined;
  }): Promise<{ duplicate: boolean }> {
    const original = parseObject(input.rawBody);
    const provider = providerFromSlug(input.provider);
    let payload = original;

    if (provider === "STRIPE") {
      if (!env.STRIPE_WEBHOOK_SECRET) throw providerNotConfigured("Stripe");
      if (!verifyStripeWebhook(input.rawBody, input.signature, env.STRIPE_WEBHOOK_SECRET)) {
        throw unauthorized("Assinatura de webhook inválida");
      }
    } else if (provider === "MERCADO_PAGO") {
      if (!env.MERCADO_PAGO_WEBHOOK_SECRET || !env.MERCADO_PAGO_ACCESS_TOKEN) {
        throw providerNotConfigured("Mercado Pago");
      }
      const dataId = input.dataId ?? stringAt(original, "data", "id");
      if (
        !dataId ||
        !verifyMercadoPagoWebhook({
          dataId,
          requestId: input.requestId,
          signatureHeader: input.signature,
          secret: env.MERCADO_PAGO_WEBHOOK_SECRET,
        })
      ) {
        throw unauthorized("Assinatura de webhook inválida");
      }
      payload = await hydrateMercadoPago(original, dataId);
    } else {
      if (!env.ASAAS_WEBHOOK_TOKEN) throw providerNotConfigured("Asaas");
      if (!input.asaasToken || !constantTimeEqual(input.asaasToken, env.ASAAS_WEBHOOK_TOKEN)) {
        throw unauthorized("Token de webhook inválido");
      }
    }

    const tenantId = await resolveTenantId(provider, payload);
    if (!tenantId) {
      throw new AppError(422, "TENANT_NOT_RESOLVED", "Não foi possível identificar a empresa do evento");
    }
    const externalEventId = eventId(provider, original, payload);
    const eventType = eventTypeOf(provider, original, payload);
    const created = await prisma.billingWebhookEvent.createMany({
      data: [{
        tenantId,
        provider,
        externalEventId,
        eventType,
        payloadHash: sha256(input.rawBody.toString("utf8")),
        payload: payload as Prisma.InputJsonValue,
      }],
      skipDuplicates: true,
    });
    if (created.count === 0) return { duplicate: true };

    try {
      await processProviderEvent(provider, tenantId, eventType, payload);
      await prisma.billingWebhookEvent.update({
        where: { provider_externalEventId: { provider, externalEventId } },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
      return { duplicate: false };
    } catch (error) {
      await prisma.billingWebhookEvent.updateMany({
        where: { provider, externalEventId, tenantId },
        data: { status: "FAILED" },
      });
      throw error;
    }
  }
}

async function hydrateMercadoPago(original: JsonObject, dataId: string): Promise<JsonObject> {
  const kind = stringAt(original, "type") ?? stringAt(original, "topic") ?? "";
  const endpoint = kind.includes("payment")
    ? `https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`
    : `https://api.mercadopago.com/preapproval/${encodeURIComponent(dataId)}`;
  const hydrated = await providerRequest<unknown>("Mercado Pago", endpoint, {
    method: "GET",
    headers: { authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN!}` },
  });
  return { webhook: original, resource: asObject(hydrated) };
}

async function resolveTenantId(provider: PaymentProvider, payload: JsonObject): Promise<string | null> {
  const resource = asObject(payload.resource) ?? asObject(asObject(payload.data)?.object) ?? payload;
  const direct =
    stringAt(resource, "metadata", "tenantId") ??
    tenantFromExternalReference(stringAt(resource, "external_reference")) ??
    tenantFromExternalReference(stringAt(resource, "externalReference")) ??
    stringAt(resource, "client_reference_id");
  if (direct && (await prisma.tenant.findUnique({ where: { id: direct }, select: { id: true } }))) {
    return direct;
  }

  const subscriptionId =
    referenceId(resource.subscription) ??
    stringAt(resource, "preapproval_id") ??
    referenceId(asObject(resource.payment)?.subscription);
  if (!subscriptionId) return null;
  const subscription = await prisma.subscription.findFirst({
    where: { provider, providerSubscriptionId: subscriptionId },
    select: { tenantId: true },
  });
  return subscription?.tenantId ?? null;
}

async function processProviderEvent(
  provider: PaymentProvider,
  tenantId: string,
  eventType: string,
  payload: JsonObject,
): Promise<void> {
  const resource = asObject(payload.resource) ?? asObject(asObject(payload.data)?.object) ?? payload;
  if (provider === "STRIPE") {
    await processStripe(tenantId, eventType, resource);
  } else if (provider === "MERCADO_PAGO") {
    await processMercadoPago(tenantId, eventType, resource);
  } else {
    await processAsaas(tenantId, eventType, resource);
  }
}

async function processStripe(tenantId: string, eventType: string, object: JsonObject): Promise<void> {
  if (eventType === "checkout.session.completed") {
    const planId = stringAt(object, "metadata", "planId");
    const checkoutId = stringAt(object, "id");
    const subscriptionId = referenceId(object.subscription);
    if (!planId || !checkoutId || !subscriptionId) return;
    await prisma.subscription.updateMany({
      where: { tenantId, planId, provider: "STRIPE", providerSubscriptionId: checkoutId },
      data: { providerSubscriptionId: subscriptionId, status: "ACTIVE" },
    });
    return;
  }
  if (eventType.startsWith("customer.subscription.")) {
    const subscriptionId = stringAt(object, "id");
    if (!subscriptionId) return;
    const status = mapStripeStatus(stringAt(object, "status"));
    const currentPeriodStart = unixDate(object.current_period_start);
    const currentPeriodEnd = unixDate(object.current_period_end);
    await prisma.subscription.updateMany({
      where: { tenantId, provider: "STRIPE", providerSubscriptionId: subscriptionId },
      data: {
        status,
        ...(eventType.endsWith("deleted") ? { canceledAt: new Date() } : {}),
        ...(currentPeriodStart ? { currentPeriodStart } : {}),
        ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
      },
    });
    return;
  }
  if (eventType === "invoice.paid" || eventType === "invoice.payment_failed") {
    const subscriptionId = referenceId(object.subscription);
    const paymentId = stringAt(object, "id");
    if (!subscriptionId || !paymentId) return;
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId, provider: "STRIPE", providerSubscriptionId: subscriptionId },
      select: { id: true },
    });
    if (!subscription) return;
    const amount = numberAt(object, eventType === "invoice.paid" ? "amount_paid" : "amount_due") / 100;
    await prisma.payment.upsert({
      where: { provider_providerPaymentId: { provider: "STRIPE", providerPaymentId: paymentId } },
      create: {
        tenantId,
        subscriptionId: subscription.id,
        provider: "STRIPE",
        providerPaymentId: paymentId,
        amount,
        currency: (stringAt(object, "currency") ?? "BRL").toUpperCase(),
        status: eventType === "invoice.paid" ? "PAID" : "FAILED",
        paidAt: eventType === "invoice.paid" ? new Date() : null,
      },
      update: {
        status: eventType === "invoice.paid" ? "PAID" : "FAILED",
        paidAt: eventType === "invoice.paid" ? new Date() : null,
      },
    });
  }
}

async function processMercadoPago(tenantId: string, eventType: string, resource: JsonObject): Promise<void> {
  const externalId = stringAt(resource, "id");
  if (!externalId) return;
  if (!eventType.includes("payment")) {
    await prisma.subscription.updateMany({
      where: { tenantId, provider: "MERCADO_PAGO", providerSubscriptionId: externalId },
      data: { status: mapMercadoPagoStatus(stringAt(resource, "status")) },
    });
    return;
  }
  const subscriptionId = stringAt(resource, "preapproval_id");
  if (!subscriptionId) return;
  const subscription = await prisma.subscription.findFirst({
    where: { tenantId, provider: "MERCADO_PAGO", providerSubscriptionId: subscriptionId },
    select: { id: true },
  });
  if (!subscription) return;
  const paid = stringAt(resource, "status") === "approved";
  await prisma.payment.upsert({
    where: { provider_providerPaymentId: { provider: "MERCADO_PAGO", providerPaymentId: externalId } },
    create: {
      tenantId,
      subscriptionId: subscription.id,
      provider: "MERCADO_PAGO",
      providerPaymentId: externalId,
      amount: numberAt(resource, "transaction_amount"),
      currency: stringAt(resource, "currency_id") ?? "BRL",
      status: (stringAt(resource, "status") ?? "unknown").toUpperCase(),
      paidAt: paid ? new Date() : null,
    },
    update: {
      status: (stringAt(resource, "status") ?? "unknown").toUpperCase(),
      paidAt: paid ? new Date() : null,
    },
  });
}

async function processAsaas(tenantId: string, eventType: string, payload: JsonObject): Promise<void> {
  const payment = asObject(payload.payment) ?? payload;
  const paymentId = stringAt(payment, "id");
  const providerSubscriptionId = referenceId(payment.subscription);
  if (!paymentId || !providerSubscriptionId) return;
  const subscription = await prisma.subscription.findFirst({
    where: { tenantId, provider: "ASAAS", providerSubscriptionId },
    select: { id: true },
  });
  if (!subscription) return;
  const paid = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(eventType);
  const overdue = eventType === "PAYMENT_OVERDUE";
  await prisma.$transaction([
    prisma.payment.upsert({
      where: { provider_providerPaymentId: { provider: "ASAAS", providerPaymentId: paymentId } },
      create: {
        tenantId,
        subscriptionId: subscription.id,
        provider: "ASAAS",
        providerPaymentId: paymentId,
        amount: numberAt(payment, "value"),
        currency: "BRL",
        status: (stringAt(payment, "status") ?? eventType).toUpperCase(),
        paidAt: paid ? new Date() : null,
      },
      update: {
        status: (stringAt(payment, "status") ?? eventType).toUpperCase(),
        paidAt: paid ? new Date() : null,
      },
    }),
    prisma.subscription.updateMany({
      where: { id: subscription.id, tenantId },
      data: { status: paid ? "ACTIVE" : overdue ? "PAST_DUE" : "TRIALING" },
    }),
  ]);
}

function eventId(provider: PaymentProvider, original: JsonObject, payload: JsonObject): string {
  if (provider === "MERCADO_PAGO") {
    const resource = asObject(payload.resource);
    return `${eventTypeOf(provider, original, payload)}:${stringAt(resource ?? {}, "id") ?? "unknown"}`;
  }
  return stringAt(original, "id") ?? sha256(JSON.stringify(original)).slice(0, 40);
}

function eventTypeOf(provider: PaymentProvider, original: JsonObject, payload: JsonObject): string {
  if (provider === "STRIPE") return stringAt(original, "type") ?? "unknown";
  if (provider === "ASAAS") return stringAt(original, "event") ?? "unknown";
  return stringAt(original, "type") ?? stringAt(original, "topic") ?? stringAt(payload, "type") ?? "unknown";
}

function mapStripeStatus(value: string | undefined): SubscriptionStatus {
  if (value === "active") return "ACTIVE";
  if (value === "trialing") return "TRIALING";
  if (value === "past_due" || value === "unpaid") return "PAST_DUE";
  if (value === "canceled" || value === "incomplete_expired") return "CANCELED";
  return "SUSPENDED";
}

function mapMercadoPagoStatus(value: string | undefined): SubscriptionStatus {
  if (value === "authorized") return "ACTIVE";
  if (value === "pending") return "TRIALING";
  if (value === "paused") return "SUSPENDED";
  if (value === "cancelled") return "CANCELED";
  return "PAST_DUE";
}

function parseObject(rawBody: Buffer): JsonObject {
  try {
    const parsed = JSON.parse(rawBody.toString("utf8")) as unknown;
    const object = asObject(parsed);
    if (!object) throw new Error("not an object");
    return object;
  } catch {
    throw new AppError(400, "INVALID_WEBHOOK", "Corpo de webhook inválido");
  }
}

function providerFromSlug(value: ProviderSlug): PaymentProvider {
  if (value === "stripe") return "STRIPE";
  if (value === "mercado-pago") return "MERCADO_PAGO";
  return "ASAAS";
}

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function stringAt(object: JsonObject, ...path: string[]): string | undefined {
  let current: unknown = object;
  for (const key of path) current = asObject(current)?.[key];
  return typeof current === "string" && current.length > 0 ? current : undefined;
}

function numberAt(object: JsonObject, key: string): number {
  const value = object[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function referenceId(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  const object = asObject(value);
  return object ? stringAt(object, "id") : undefined;
}

function tenantFromExternalReference(value: string | undefined): string | undefined {
  return value?.split(":", 1)[0];
}

function unixDate(value: unknown): Date | undefined {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1_000) : undefined;
}

function providerNotConfigured(name: string): AppError {
  return new AppError(503, "PROVIDER_NOT_CONFIGURED", `${name} ainda não foi configurado`);
}
