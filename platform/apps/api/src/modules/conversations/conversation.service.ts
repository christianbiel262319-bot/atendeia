import { AppError, forbidden } from "../../core/errors/app-error.js";
import type { TenantContext } from "../../core/tenant/tenant-context.js";
import { prisma } from "../../infra/database/prisma.js";
import { WhatsAppOutboundService } from "../whatsapp/outbound.service.js";

const outboundService = new WhatsAppOutboundService();

export class ConversationService {
  async list(
    context: TenantContext,
    input: {
      status?: "OPEN" | "WAITING_HUMAN" | "WITH_HUMAN" | "RESOLVED" | "ARCHIVED" | undefined;
      search?: string | undefined;
      limit: number;
    },
  ) {
    return prisma.conversation.findMany({
      where: {
        tenantId: context.tenantId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.search
          ? {
              contact: {
                OR: [
                  { displayName: { contains: input.search, mode: "insensitive" } },
                  { phoneE164: { contains: input.search } },
                ],
              },
            }
          : {}),
      },
      select: {
        id: true,
        status: true,
        needsHumanReason: true,
        assignedMembershipId: true,
        updatedAt: true,
        contact: { select: { id: true, displayName: true, phoneE164: true, tags: true } },
        messages: {
          select: { body: true, sender: true, createdAt: true, status: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: input.limit,
    });
  }

  async get(context: TenantContext, id: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id, tenantId: context.tenantId },
      include: {
        contact: true,
        messages: { orderBy: { createdAt: "asc" }, take: 500 },
      },
    });
    if (!conversation) throw new AppError(404, "NOT_FOUND", "Conversa não encontrada");
    return conversation;
  }

  async assign(context: TenantContext, conversationId: string, membershipId: string | null) {
    if (membershipId) {
      const membership = await prisma.membership.findFirst({
        where: { id: membershipId, tenantId: context.tenantId, active: true },
        select: { id: true },
      });
      if (!membership) throw new AppError(404, "MEMBER_NOT_FOUND", "Membro não encontrado");
    }
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.conversation.updateMany({
        where: { id: conversationId, tenantId: context.tenantId },
        data: {
          assignedMembershipId: membershipId,
          status: membershipId ? "WITH_HUMAN" : "WAITING_HUMAN",
        },
      });
      if (updated.count === 1) {
        await tx.auditLog.create({
          data: {
            tenantId: context.tenantId,
            actorUserId: context.userId,
            action: membershipId
              ? "conversation.assigned_to_human"
              : "conversation.unassigned",
            resourceType: "conversation",
            resourceId: conversationId,
            metadata: { membershipId },
          },
        });
      }
      return updated;
    });
    if (result.count !== 1) throw new AppError(404, "NOT_FOUND", "Conversa não encontrada");
    return this.get(context, conversationId);
  }

  async sendHumanMessage(context: TenantContext, conversationId: string, body: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId: context.tenantId },
      select: {
        id: true,
        status: true,
        assignedMembershipId: true,
        contact: { select: { whatsappUserId: true } },
      },
    });
    if (!conversation) throw new AppError(404, "NOT_FOUND", "Conversa não encontrada");

    const actorMembership = await prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId: context.tenantId, userId: context.userId } },
      select: { id: true, role: true },
    });
    if (!actorMembership) throw forbidden();
    if (
      actorMembership.role === "AGENT" &&
      conversation.assignedMembershipId &&
      conversation.assignedMembershipId !== actorMembership.id
    ) {
      throw forbidden("A conversa está atribuída a outra pessoa");
    }

    const connection = await prisma.whatsAppConnection.findFirst({
      where: { tenantId: context.tenantId, status: "CONNECTED" },
      select: { phoneNumberId: true },
      orderBy: { createdAt: "desc" },
    });
    if (!connection) throw new AppError(409, "WHATSAPP_NOT_CONNECTED", "Conecte o WhatsApp antes de responder");

    await prisma.conversation.updateMany({
      where: { id: conversation.id, tenantId: context.tenantId },
      data: {
        status: "WITH_HUMAN",
        assignedMembershipId: conversation.assignedMembershipId ?? actorMembership.id,
      },
    });
    const message = await outboundService.send({
      tenantId: context.tenantId,
      conversationId: conversation.id,
      phoneNumberId: connection.phoneNumberId,
      to: conversation.contact.whatsappUserId,
      body,
      sender: "HUMAN",
    });
    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        actorUserId: context.userId,
        action: "conversation.human_message_sent",
        resourceType: "conversation",
        resourceId: conversation.id,
        metadata: { messageId: message.id },
      },
    });
    return message;
  }

  async resolve(context: TenantContext, conversationId: string): Promise<void> {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.conversation.updateMany({
        where: { id: conversationId, tenantId: context.tenantId },
        data: { status: "RESOLVED", resolvedAt: new Date(), needsHumanReason: null },
      });
      if (updated.count === 1) {
        await tx.auditLog.create({
          data: {
            tenantId: context.tenantId,
            actorUserId: context.userId,
            action: "conversation.resolved",
            resourceType: "conversation",
            resourceId: conversationId,
          },
        });
      }
      return updated;
    });
    if (result.count !== 1) throw new AppError(404, "NOT_FOUND", "Conversa não encontrada");
  }
}
