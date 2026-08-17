import type { TenantContext } from "../../core/tenant/tenant-context.js";
import { prisma } from "../../infra/database/prisma.js";
import { TenantService } from "../tenants/tenant.service.js";

const tenantService = new TenantService();

export class DashboardService {
  async summary(context: TenantContext) {
    const [conversations, messages, waitingHuman, members, whatsapp, onboarding] = await Promise.all([
      prisma.conversation.count({ where: { tenantId: context.tenantId } }),
      prisma.message.count({ where: { tenantId: context.tenantId } }),
      prisma.conversation.count({
        where: { tenantId: context.tenantId, status: "WAITING_HUMAN" },
      }),
      prisma.membership.count({ where: { tenantId: context.tenantId, active: true } }),
      prisma.whatsAppConnection.findFirst({
        where: { tenantId: context.tenantId },
        select: { status: true, displayPhoneNumber: true },
        orderBy: { createdAt: "desc" },
      }),
      tenantService.onboardingStatus(context),
    ]);
    return { conversations, messages, waitingHuman, members, whatsapp, onboarding };
  }
}
