import type { PaymentProvider } from "../../generated/prisma/enums.js";
import { AppError, conflict } from "../../core/errors/app-error.js";
import type { TenantContext } from "../../core/tenant/tenant-context.js";
import { prisma } from "../../infra/database/prisma.js";
import { AsaasProvider } from "./providers/asaas.provider.js";
import { MercadoPagoProvider } from "./providers/mercado-pago.provider.js";
import type { BillingProviderAdapter } from "./providers/provider.types.js";
import { StripeProvider } from "./providers/stripe.provider.js";

const providers: Record<PaymentProvider, BillingProviderAdapter> = {
  STRIPE: new StripeProvider(),
  MERCADO_PAGO: new MercadoPagoProvider(),
  ASAAS: new AsaasProvider(),
};

export class BillingService {
  listPlans() {
    return prisma.plan.findMany({
      where: { active: true },
      select: {
        id: true,
        code: true,
        name: true,
        monthlyPrice: true,
        currency: true,
        limits: true,
      },
      orderBy: { monthlyPrice: "asc" },
    });
  }

  current(context: TenantContext) {
    return prisma.subscription.findFirst({
      where: { tenantId: context.tenantId },
      include: {
        plan: true,
        payments: { orderBy: { createdAt: "desc" }, take: 20 },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async checkout(
    context: TenantContext,
    input: { planId: string; provider: PaymentProvider; taxId?: string | undefined },
  ) {
    const [plan, user, active] = await Promise.all([
      prisma.plan.findFirst({ where: { id: input.planId, active: true } }),
      prisma.user.findUnique({
        where: { id: context.userId },
        select: { fullName: true, email: true },
      }),
      prisma.subscription.findFirst({
        where: {
          tenantId: context.tenantId,
          status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] },
        },
        select: { id: true },
      }),
    ]);
    if (!plan) throw new AppError(404, "PLAN_NOT_FOUND", "Plano não encontrado");
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "Usuário não encontrado");
    if (active) throw conflict("Já existe uma assinatura em andamento para esta empresa");

    const pending = await prisma.subscription.create({
      data: {
        tenantId: context.tenantId,
        planId: plan.id,
        provider: input.provider,
        status: "TRIALING",
      },
      select: { id: true },
    });

    try {
      const result = await providers[input.provider].createCheckout({
        tenantId: context.tenantId,
        idempotencyKey: pending.id,
        plan: {
          id: plan.id,
          name: plan.name,
          monthlyPrice: plan.monthlyPrice.toNumber(),
          currency: plan.currency,
        },
        customer: {
          name: user.fullName,
          email: user.email,
          ...(input.taxId ? { taxId: input.taxId } : {}),
        },
      });
      const subscription = await prisma.$transaction(async (tx) => {
        const updated = await tx.subscription.update({
          where: { id: pending.id },
          data: { providerSubscriptionId: result.externalId },
          include: { plan: true },
        });
        await tx.auditLog.create({
          data: {
            tenantId: context.tenantId,
            actorUserId: context.userId,
            action: "billing.checkout_created",
            resourceType: "subscription",
            resourceId: updated.id,
            metadata: { provider: input.provider, planCode: plan.code },
          },
        });
        return updated;
      });
      return { subscription, redirectUrl: result.redirectUrl };
    } catch (error) {
      await prisma.subscription.updateMany({
        where: { id: pending.id, tenantId: context.tenantId },
        data: { status: "CANCELED", canceledAt: new Date() },
      });
      throw error;
    }
  }

  async cancel(context: TenantContext): Promise<void> {
    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId: context.tenantId,
        status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "SUSPENDED"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!subscription?.providerSubscriptionId) {
      throw new AppError(404, "SUBSCRIPTION_NOT_FOUND", "Assinatura ativa não encontrada");
    }
    await providers[subscription.provider].cancel(subscription.providerSubscriptionId);
    await prisma.$transaction([
      prisma.subscription.updateMany({
        where: { id: subscription.id, tenantId: context.tenantId },
        data: { status: "CANCELED", canceledAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          tenantId: context.tenantId,
          actorUserId: context.userId,
          action: "billing.subscription_canceled",
          resourceType: "subscription",
          resourceId: subscription.id,
          metadata: { provider: subscription.provider },
        },
      }),
    ]);
  }
}
