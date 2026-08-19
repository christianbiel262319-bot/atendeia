import { randomUUID } from "node:crypto";
import { AppError, forbidden } from "../../core/errors/app-error.js";
import { secureToken, sha256 } from "../../core/security/crypto.js";
import type { TenantContext } from "../../core/tenant/tenant-context.js";
import { prisma } from "../../infra/database/prisma.js";
import {
  canInviteRole,
  canUpdateMembership,
  type AssignableTeamRole,
  type InvitableTeamRole,
} from "./team-policy.js";

export class TeamService {
  list(context: TenantContext) {
    return prisma.membership.findMany({
      where: { tenantId: context.tenantId },
      select: {
        id: true,
        role: true,
        active: true,
        mfaEnabled: true,
        createdAt: true,
        user: { select: { id: true, fullName: true, email: true, status: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async invite(context: TenantContext, input: { email: string; role: InvitableTeamRole }) {
    if (!canInviteRole(context.role, input.role)) {
      throw forbidden("Seu perfil não pode conceder esta função");
    }
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
      select: { memberships: { where: { tenantId: context.tenantId }, select: { id: true } } },
    });
    if (existingUser?.memberships.length) {
      throw new AppError(409, "ALREADY_MEMBER", "Esta pessoa já faz parte da empresa");
    }
    const token = secureToken(32);
    const invitation = await prisma.teamInvitation.create({
      data: {
        tenantId: context.tenantId,
        email: input.email,
        role: input.role,
        tokenHash: sha256(token),
        createdByUserId: context.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
      },
      select: { id: true, email: true, role: true, expiresAt: true },
    });
    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        actorUserId: context.userId,
        action: "team.invitation_created",
        resourceType: "team_invitation",
        resourceId: invitation.id,
        metadata: { role: invitation.role },
      },
    });
    return { ...invitation, token };
  }

  async accept(context: TenantContext, token: string) {
    const invitation = await prisma.teamInvitation.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date()
    ) {
      throw new AppError(410, "INVITATION_INVALID", "Convite inválido ou expirado");
    }
    const user = await prisma.user.findUnique({ where: { id: context.userId }, select: { email: true } });
    if (!user || user.email !== invitation.email) throw forbidden("O convite pertence a outro e-mail");

    await prisma.$transaction([
      prisma.membership.upsert({
        where: { tenantId_userId: { tenantId: invitation.tenantId, userId: context.userId } },
        create: {
          id: randomUUID(),
          tenantId: invitation.tenantId,
          userId: context.userId,
          role: invitation.role,
        },
        update: { active: true, role: invitation.role },
      }),
      prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          tenantId: invitation.tenantId,
          actorUserId: context.userId,
          action: "team.invitation_accepted",
          resourceType: "team_invitation",
          resourceId: invitation.id,
        },
      }),
    ]);
    return { tenantId: invitation.tenantId };
  }

  async updateMember(
    context: TenantContext,
    membershipId: string,
    input: { role?: AssignableTeamRole | undefined; active?: boolean | undefined },
  ) {
    const membership = await prisma.membership.findFirst({
      where: { id: membershipId, tenantId: context.tenantId },
    });
    if (!membership) throw new AppError(404, "NOT_FOUND", "Membro não encontrado");
    if (!canUpdateMembership({
      actorRole: context.role,
      actorUserId: context.userId,
      targetUserId: membership.userId,
      targetRole: membership.role,
      ...(input.role !== undefined ? { nextRole: input.role } : {}),
    })) {
      throw forbidden("Seu perfil não pode alterar este membro ou conceder esta função");
    }
    if (membership.userId === context.userId && input.active === false) {
      throw forbidden("Você não pode desativar a própria associação");
    }
    if (membership.role === "OWNER" && (input.role !== undefined || input.active === false)) {
      const owners = await prisma.membership.count({
        where: { tenantId: context.tenantId, role: "OWNER", active: true },
      });
      if (owners <= 1) throw forbidden("A empresa precisa manter pelo menos um proprietário ativo");
    }
    await prisma.membership.updateMany({
      where: { id: membershipId, tenantId: context.tenantId },
      data: {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
    const updated = await prisma.membership.findFirstOrThrow({
      where: { id: membershipId, tenantId: context.tenantId },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        actorUserId: context.userId,
        action: "team.membership_updated",
        resourceType: "membership",
        resourceId: membershipId,
        metadata: {
          ...(input.role !== undefined ? { role: input.role } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
      },
    });
    return updated;
  }
}
