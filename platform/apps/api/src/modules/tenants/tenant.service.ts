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
    const [connection, productCount, serviceCount, faqCount, businessHourCount, exceptionCount, companyProfile, ai, memberCount] =
      await prisma.$transaction([
        prisma.whatsAppConnection.findFirst({
          where: { tenantId: context.tenantId },
          select: { status: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.product.count({ where: { tenantId: context.tenantId, status: "ACTIVE" } }),
        prisma.service.count({ where: { tenantId: context.tenantId, status: "ACTIVE" } }),
        prisma.faq.count({ where: { tenantId: context.tenantId, status: "ACTIVE" } }),
        prisma.businessHour.count({ where: { tenantId: context.tenantId } }),
        prisma.businessHourException.count({ where: { tenantId: context.tenantId } }),
        prisma.companyProfile.findUnique({
          where: { tenantId: context.tenantId },
          select: { description: true, address: true, phoneE164: true, email: true, policies: true, usefulLinks: true },
        }),
        prisma.aiConfiguration.findUnique({
          where: { tenantId: context.tenantId },
          select: { id: true },
        }),
        prisma.membership.count({ where: { tenantId: context.tenantId, active: true } }),
      ]);
    return calculateOnboardingStatus({
      whatsapp: connection?.status === "CONNECTED",
      knowledge: productCount + serviceCount + faqCount + businessHourCount + exceptionCount > 0 || companyProfileHasKnowledge(companyProfile),
      ai: Boolean(ai),
      team: memberCount > 1,
    });
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

type OnboardingSteps = { whatsapp: boolean; knowledge: boolean; ai: boolean; team: boolean };

export function calculateOnboardingStatus(steps: OnboardingSteps) {
  return { steps, completed: Object.values(steps).filter(Boolean).length, total: Object.keys(steps).length };
}

function companyProfileHasKnowledge(profile: { description: string | null; address: string | null; phoneE164: string | null; email: string | null; policies: string | null; usefulLinks: unknown } | null): boolean {
  if (!profile) return false;
  const hasText = [profile.description, profile.address, profile.phoneE164, profile.email, profile.policies].some((value) => Boolean(value?.trim()));
  return hasText || (Array.isArray(profile.usefulLinks) && profile.usefulLinks.length > 0);
}
