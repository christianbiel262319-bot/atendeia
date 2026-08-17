import { forbidden } from "../../core/errors/app-error.js";
import type { TenantContext } from "../../core/tenant/tenant-context.js";
import { prisma } from "../../infra/database/prisma.js";

export class TenantService {
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
