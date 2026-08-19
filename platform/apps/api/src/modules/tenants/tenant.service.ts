import { forbidden } from "../../core/errors/app-error.js";
import type { TenantContext } from "../../core/tenant/tenant-context.js";
import { prisma } from "../../infra/database/prisma.js";
import { env } from "../../config/env.js";

export class TenantService {
  async profile(context: TenantContext) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: context.tenantId },
      select: { id: true, name: true, slug: true, timezone: true, status: true, createdAt: true },
    });
    if (!tenant) throw forbidden("Empresa indisponível");
    return tenant;
  }

  async updateProfile(context: TenantContext, input: { name: string; timezone: string }) {
    const [tenant] = await prisma.$transaction([
      prisma.tenant.update({
        where: { id: context.tenantId },
        data: input,
        select: { id: true, name: true, slug: true, timezone: true, status: true, createdAt: true },
      }),
      prisma.auditLog.create({
        data: {
          tenantId: context.tenantId,
          actorUserId: context.userId,
          action: "tenant.profile_updated",
          resourceType: "tenant",
          resourceId: context.tenantId,
          metadata: { name: input.name, timezone: input.timezone },
        },
      }),
    ]);
    return tenant;
  }

  capabilities() {
    return {
      ai: { configured: Boolean(env.OPENAI_API_KEY) },
      whatsapp: {
        configured: Boolean(env.META_APP_SECRET && env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
      },
      billing: {
        STRIPE: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
        MERCADO_PAGO: Boolean(
          env.MERCADO_PAGO_ACCESS_TOKEN && env.MERCADO_PAGO_WEBHOOK_SECRET,
        ),
        ASAAS: Boolean(env.ASAAS_API_KEY && env.ASAAS_WEBHOOK_TOKEN),
      },
      media: {
        configured: Boolean(
          env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
        ),
      },
    };
  }

  async onboardingStatus(context: TenantContext) {
    const [connection, productCount, serviceCount, faqCount, ai, memberCount] =
      await prisma.$transaction([
        prisma.whatsAppConnection.findFirst({
          where: { tenantId: context.tenantId, status: "CONNECTED" },
          select: { id: true },
        }),
        prisma.product.count({ where: { tenantId: context.tenantId, status: "ACTIVE" } }),
        prisma.service.count({ where: { tenantId: context.tenantId, status: "ACTIVE" } }),
        prisma.faq.count({ where: { tenantId: context.tenantId, status: "ACTIVE" } }),
        prisma.aiConfiguration.findUnique({
          where: { tenantId: context.tenantId },
          select: { enabled: true },
        }),
        prisma.membership.count({ where: { tenantId: context.tenantId, active: true } }),
      ]);
    const steps = {
      whatsapp: Boolean(connection),
      knowledge: productCount + serviceCount + faqCount > 0,
      ai: Boolean(ai?.enabled),
      team: memberCount > 1,
    };
    return { steps, completed: Object.values(steps).filter(Boolean).length, total: 4 };
  }

  async listMemberships(context: TenantContext) {
    return prisma.membership.findMany({
      where: { tenantId: context.tenantId, active: true },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, email: true, fullName: true, status: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  assertResourceBelongsToTenant(
    context: TenantContext,
    resource: { tenantId: string } | null,
  ): void {
    if (!resource || resource.tenantId !== context.tenantId) {
      throw forbidden("Recurso não pertence ao tenant ativo");
    }
  }
}
