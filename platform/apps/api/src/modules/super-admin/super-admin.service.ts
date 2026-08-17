import type { Prisma } from "../../generated/prisma/client.js";
import type { TenantStatus } from "../../generated/prisma/enums.js";
import { AppError } from "../../core/errors/app-error.js";
import type { TenantContext } from "../../core/tenant/tenant-context.js";
import { prisma } from "../../infra/database/prisma.js";
import type { z } from "zod";
import type { planCreateSchema, planUpdateSchema } from "../billing/billing.schemas.js";

export class SuperAdminService {
  async overview() {
    const [tenants, users, activeSubscriptions, openConversations, webhookFailures] =
      await prisma.$transaction([
        prisma.tenant.count(),
        prisma.user.count(),
        prisma.subscription.count({ where: { status: "ACTIVE" } }),
        prisma.conversation.count({ where: { status: { in: ["OPEN", "WAITING_HUMAN", "WITH_HUMAN"] } } }),
        prisma.webhookEvent.count({ where: { status: "FAILED" } }),
      ]);
    return { tenants, users, activeSubscriptions, openConversations, webhookFailures };
  }

  listTenants(input: {
    search?: string | undefined;
    status?: TenantStatus | undefined;
    limit: number;
  }) {
    return prisma.tenant.findMany({
      where: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.search
          ? { OR: [{ name: { contains: input.search, mode: "insensitive" } }, { slug: { contains: input.search, mode: "insensitive" } }] }
          : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        _count: { select: { memberships: true, conversations: true } },
        subscriptions: {
          select: { status: true, provider: true, plan: { select: { code: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: input.limit,
    });
  }

  async updateTenantStatus(
    context: TenantContext,
    tenantId: string,
    input: { status: TenantStatus; reason: string },
  ) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw new AppError(404, "TENANT_NOT_FOUND", "Empresa não encontrada");
    return prisma.$transaction(async (tx) => {
      const updated = await tx.tenant.update({ where: { id: tenantId }, data: { status: input.status } });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: context.userId,
          action: "super_admin.tenant_status_updated",
          resourceType: "tenant",
          resourceId: tenantId,
          metadata: { status: input.status, reason: input.reason },
        },
      });
      return updated;
    });
  }

  async createPlan(context: TenantContext, input: z.infer<typeof planCreateSchema>) {
    const plan = await prisma.plan.create({
      data: { ...input, limits: input.limits },
    });
    await this.auditPlan(context, plan.id, "super_admin.plan_created");
    return plan;
  }

  async updatePlan(
    context: TenantContext,
    id: string,
    input: z.infer<typeof planUpdateSchema>,
  ) {
    const exists = await prisma.plan.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new AppError(404, "PLAN_NOT_FOUND", "Plano não encontrado");
    const data: Prisma.PlanUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.monthlyPrice !== undefined) data.monthlyPrice = input.monthlyPrice;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.active !== undefined) data.active = input.active;
    if (input.limits !== undefined) data.limits = input.limits;
    const plan = await prisma.plan.update({
      where: { id },
      data,
    });
    await this.auditPlan(context, plan.id, "super_admin.plan_updated");
    return plan;
  }

  listPlans() {
    return prisma.plan.findMany({ orderBy: { monthlyPrice: "asc" } });
  }

  private async auditPlan(context: TenantContext, planId: string, action: string): Promise<void> {
    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        actorUserId: context.userId,
        action,
        resourceType: "plan",
        resourceId: planId,
      },
    });
  }
}
