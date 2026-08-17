import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../core/errors/app-error.js";
import type { TenantContext } from "../../core/tenant/tenant-context.js";
import { prisma } from "../../infra/database/prisma.js";

export class CrmService {
  list(context: TenantContext, input: { search?: string | undefined; limit: number }) {
    return prisma.contact.findMany({
      where: {
        tenantId: context.tenantId,
        ...(input.search
          ? {
              OR: [
                { displayName: { contains: input.search, mode: "insensitive" as const } },
                { phoneE164: { contains: input.search } },
                { email: { contains: input.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        displayName: true,
        phoneE164: true,
        email: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { conversations: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: input.limit,
    });
  }

  async update(
    context: TenantContext,
    id: string,
    input: { displayName?: string | null | undefined; email?: string | null | undefined; tags?: string[] | undefined },
  ) {
    const data: Prisma.ContactUpdateManyMutationInput = {
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
    };
    const result = await prisma.contact.updateMany({
      where: { id, tenantId: context.tenantId },
      data,
    });
    if (result.count !== 1) throw new AppError(404, "NOT_FOUND", "Contato não encontrado");
    const contact = await prisma.contact.findFirstOrThrow({ where: { id, tenantId: context.tenantId } });
    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        actorUserId: context.userId,
        action: "crm.contact_updated",
        resourceType: "contact",
        resourceId: id,
      },
    });
    return contact;
  }
}
