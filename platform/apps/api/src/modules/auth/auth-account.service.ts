import bcrypt from "bcrypt";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError, unauthorized } from "../../core/errors/app-error.js";
import { decryptSecret, keyedHash, secureToken, sha256 } from "../../core/security/crypto.js";
import { verifyTotp } from "../../core/security/totp.js";
import type { TenantContext } from "../../core/tenant/tenant-context.js";
import { prisma } from "../../infra/database/prisma.js";
import {
  emailDeliveryConfigured,
  escapeHtml,
  sendTransactionalEmail,
} from "../../infra/email/transactional-email.js";
import type { RequestFingerprint } from "./auth.types.js";

const passwordCost = 12;
const passwordResetLifetimeMs = 30 * 60 * 1_000;
const emailVerificationLifetimeMs = 24 * 60 * 60 * 1_000;

export class AuthAccountService {
  capabilities() {
    return { emailDelivery: emailDeliveryConfigured() };
  }

  async requestPasswordReset(email: string, fingerprint: RequestFingerprint) {
    const configured = emailDeliveryConfigured();
    const [user] = await Promise.all([
      prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, fullName: true, status: true },
      }),
      bcrypt.hash(email, 10),
    ]);
    if (!configured || !user || user.status === "DISABLED") {
      return { accepted: true, deliveryConfigured: configured };
    }

    const token = secureToken();
    const now = new Date();
    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: { userId: user.id, consumedAt: null },
        data: { consumedAt: now },
      }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + passwordResetLifetimeMs),
          requestedIpHash: fingerprint.ip ? keyedHash(fingerprint.ip) : null,
        },
      }),
    ]);

    const url = new URL("/redefinir-senha", env.APP_ORIGIN);
    url.searchParams.set("token", token);
    try {
      await sendTransactionalEmail({
        to: user.email,
        subject: "Redefina sua senha do AtendeIA",
        text: `Olá, ${user.fullName}. Redefina sua senha acessando ${url.toString()}. O link expira em 30 minutos.`,
        html: `<p>Olá, ${escapeHtml(user.fullName)}.</p><p>Use o link abaixo para redefinir sua senha do AtendeIA. Ele expira em 30 minutos.</p><p><a href="${escapeHtml(url.toString())}">Redefinir senha</a></p>`,
      });
    } catch (error) {
      logger.error({ error, userId: user.id }, "Password reset email delivery failed");
    }
    return { accepted: true, deliveryConfigured: configured };
  }

  async resetPassword(token: string, password: string, fingerprint: RequestFingerprint): Promise<void> {
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: {
        user: {
          select: {
            id: true,
            memberships: { where: { active: true }, select: { tenantId: true } },
          },
        },
      },
    });
    if (!record || record.consumedAt || record.expiresAt <= new Date()) {
      throw new AppError(410, "RESET_TOKEN_INVALID", "Link de redefinição inválido ou expirado");
    }
    const passwordHash = await bcrypt.hash(password, passwordCost);
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) {
        throw new AppError(410, "RESET_TOKEN_INVALID", "Link de redefinição inválido ou expirado");
      }
      await tx.user.update({
        where: { id: record.user.id },
        data: { passwordHash, failedLogins: 0, lockedUntil: null, status: "ACTIVE" },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: record.user.id, consumedAt: null },
        data: { consumedAt: now },
      });
      await tx.refreshSession.updateMany({
        where: { userId: record.user.id, revokedAt: null },
        data: { revokedAt: now, revokeReason: "PASSWORD_RESET" },
      });
      if (record.user.memberships.length) {
        await tx.auditLog.createMany({
          data: record.user.memberships.map(({ tenantId }) => ({
            tenantId,
            actorUserId: record.user.id,
            action: "auth.password_reset",
            resourceType: "user",
            resourceId: record.user.id,
            ipHash: fingerprint.ip ? keyedHash(fingerprint.ip) : null,
            userAgentHash: fingerprint.userAgent ? keyedHash(fingerprint.userAgent) : null,
          })),
        });
      }
    });
  }

  async requestEmailVerification(context: TenantContext) {
    const user = await prisma.user.findUnique({
      where: { id: context.userId },
      select: { id: true, email: true, fullName: true, emailVerifiedAt: true },
    });
    if (!user) throw unauthorized();
    if (user.emailVerifiedAt) {
      return { alreadyVerified: true, deliveryConfigured: emailDeliveryConfigured() };
    }
    const result = await this.deliverEmailVerification({
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
    });
    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        actorUserId: context.userId,
        action: "auth.email_verification_requested",
        resourceType: "user",
        resourceId: context.userId,
      },
    });
    return { alreadyVerified: false, ...result };
  }

  async confirmEmail(token: string): Promise<void> {
    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: { select: { id: true, memberships: { where: { active: true }, select: { tenantId: true } } } } },
    });
    if (!record || record.consumedAt || record.expiresAt <= new Date()) {
      throw new AppError(410, "VERIFICATION_TOKEN_INVALID", "Link de verificação inválido ou expirado");
    }
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.emailVerificationToken.updateMany({
        where: { id: record.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) {
        throw new AppError(410, "VERIFICATION_TOKEN_INVALID", "Link de verificação inválido ou expirado");
      }
      await tx.user.update({ where: { id: record.user.id }, data: { emailVerifiedAt: now } });
      await tx.emailVerificationToken.updateMany({
        where: { userId: record.user.id, consumedAt: null },
        data: { consumedAt: now },
      });
      if (record.user.memberships.length) {
        await tx.auditLog.createMany({
          data: record.user.memberships.map(({ tenantId }) => ({
            tenantId,
            actorUserId: record.user.id,
            action: "auth.email_verified",
            resourceType: "user",
            resourceId: record.user.id,
          })),
        });
      }
    });
  }

  async updateProfile(context: TenantContext, fullName: string) {
    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: context.userId },
        data: { fullName },
        select: { id: true, email: true, fullName: true, emailVerifiedAt: true },
      }),
      prisma.auditLog.create({
        data: {
          tenantId: context.tenantId,
          actorUserId: context.userId,
          action: "auth.profile_updated",
          resourceType: "user",
          resourceId: context.userId,
        },
      }),
    ]);
    return user;
  }

  async changePassword(
    context: TenantContext,
    input: { currentPassword: string; newPassword: string },
    currentRefreshToken: string | undefined,
  ): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: context.userId } });
    if (!user || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      throw unauthorized("Senha atual inválida");
    }
    const passwordHash = await bcrypt.hash(input.newPassword, passwordCost);
    const currentTokenHash = currentRefreshToken ? sha256(currentRefreshToken) : null;
    await prisma.$transaction([
      prisma.user.update({ where: { id: context.userId }, data: { passwordHash } }),
      prisma.refreshSession.updateMany({
        where: {
          userId: context.userId,
          tenantId: context.tenantId,
          revokedAt: null,
          ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
        },
        data: { revokedAt: new Date(), revokeReason: "PASSWORD_CHANGED" },
      }),
      prisma.auditLog.create({
        data: {
          tenantId: context.tenantId,
          actorUserId: context.userId,
          action: "auth.password_changed",
          resourceType: "user",
          resourceId: context.userId,
        },
      }),
    ]);
  }

  async listSessions(context: TenantContext, currentRefreshToken: string | undefined) {
    const currentHash = currentRefreshToken ? sha256(currentRefreshToken) : null;
    const sessions = await prisma.refreshSession.findMany({
      where: {
        tenantId: context.tenantId,
        userId: context.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        tokenHash: true,
        deviceLabel: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return sessions.map(({ tokenHash, ...session }) => ({ ...session, current: currentHash === tokenHash }));
  }

  async revokeSession(
    context: TenantContext,
    sessionId: string,
    currentRefreshToken: string | undefined,
  ) {
    const session = await prisma.refreshSession.findFirst({
      where: { id: sessionId, tenantId: context.tenantId, userId: context.userId, revokedAt: null },
      select: { tokenHash: true },
    });
    if (!session) throw new AppError(404, "NOT_FOUND", "Sessão não encontrada");
    await prisma.$transaction([
      prisma.refreshSession.update({ where: { id: sessionId }, data: { revokedAt: new Date(), revokeReason: "USER_REVOKED" } }),
      prisma.auditLog.create({
        data: { tenantId: context.tenantId, actorUserId: context.userId, action: "auth.session_revoked", resourceType: "session", resourceId: sessionId },
      }),
    ]);
    return { current: Boolean(currentRefreshToken && session.tokenHash === sha256(currentRefreshToken)) };
  }

  async revokeOtherSessions(context: TenantContext, currentRefreshToken: string | undefined) {
    if (!currentRefreshToken) throw unauthorized("Sessão atual indisponível");
    const current = await prisma.refreshSession.findFirst({
      where: { tokenHash: sha256(currentRefreshToken), tenantId: context.tenantId, userId: context.userId, revokedAt: null },
      select: { id: true },
    });
    if (!current) throw unauthorized("Sessão atual indisponível");
    const revoked = await prisma.refreshSession.updateMany({
      where: { tenantId: context.tenantId, userId: context.userId, revokedAt: null, id: { not: current.id } },
      data: { revokedAt: new Date(), revokeReason: "USER_REVOKED_OTHERS" },
    });
    await prisma.auditLog.create({
      data: { tenantId: context.tenantId, actorUserId: context.userId, action: "auth.other_sessions_revoked", resourceType: "session", metadata: { count: revoked.count } },
    });
    return { revoked: revoked.count };
  }

  async disableMfa(context: TenantContext, input: { password: string; code: string }): Promise<void> {
    const [user, record] = await Promise.all([
      prisma.user.findUnique({ where: { id: context.userId } }),
      prisma.mfaSecret.findUnique({ where: { tenantId_userId: { tenantId: context.tenantId, userId: context.userId } } }),
    ]);
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) throw unauthorized("Senha inválida");
    if (!record?.verifiedAt) throw new AppError(409, "MFA_NOT_ENABLED", "MFA não está ativo");
    const result = verifyTotp(decryptSecret(record.secretCiphertext), input.code);
    if (!result.valid || result.step === undefined) throw unauthorized("Código MFA inválido");
    if (record.lastUsedStep !== null && result.step <= record.lastUsedStep) throw unauthorized("Código MFA já utilizado");
    await prisma.$transaction([
      prisma.mfaSecret.delete({ where: { id: record.id } }),
      prisma.membership.update({ where: { tenantId_userId: { tenantId: context.tenantId, userId: context.userId } }, data: { mfaEnabled: false } }),
      prisma.auditLog.create({
        data: { tenantId: context.tenantId, actorUserId: context.userId, action: "auth.mfa_disabled", resourceType: "user", resourceId: context.userId },
      }),
    ]);
  }

  async deliverEmailVerification(input: { userId: string; email: string; fullName: string }) {
    const configured = emailDeliveryConfigured();
    if (!configured) return { deliveryConfigured: false };
    const token = secureToken();
    const now = new Date();
    await prisma.$transaction([
      prisma.emailVerificationToken.updateMany({ where: { userId: input.userId, consumedAt: null }, data: { consumedAt: now } }),
      prisma.emailVerificationToken.create({
        data: { userId: input.userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + emailVerificationLifetimeMs) },
      }),
    ]);
    const url = new URL("/verificar-email", env.APP_ORIGIN);
    url.searchParams.set("token", token);
    try {
      await sendTransactionalEmail({
        to: input.email,
        subject: "Confirme seu e-mail no AtendeIA",
        text: `Olá, ${input.fullName}. Confirme seu e-mail acessando ${url.toString()}. O link expira em 24 horas.`,
        html: `<p>Olá, ${escapeHtml(input.fullName)}.</p><p>Confirme seu e-mail para proteger sua conta no AtendeIA.</p><p><a href="${escapeHtml(url.toString())}">Confirmar e-mail</a></p>`,
      });
    } catch (error) {
      logger.error({ error, userId: input.userId }, "Verification email delivery failed");
    }
    return { deliveryConfigured: true };
  }
}
