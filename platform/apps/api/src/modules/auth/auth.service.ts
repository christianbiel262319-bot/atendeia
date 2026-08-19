import bcrypt from "bcrypt";
import { randomBytes, randomUUID } from "node:crypto";
import { logger } from "../../config/logger.js";
import type { MembershipRole } from "../../generated/prisma/enums.js";
import { prisma } from "../../infra/database/prisma.js";
import { AppError, conflict, forbidden, unauthorized } from "../../core/errors/app-error.js";
import type { TenantContext } from "../../core/tenant/tenant-context.js";
import {
  decryptSecret,
  encryptSecret,
  keyedHash,
  secureToken,
  sha256,
} from "../../core/security/crypto.js";
import {
  signAccessToken,
  signMfaChallenge,
  verifyMfaChallenge,
} from "../../core/security/jwt.js";
import { generateTotpSecret, totpUri, verifyTotp } from "../../core/security/totp.js";
import type { InvitationRegisterInput, LoginInput, RegisterInput } from "./auth.schemas.js";
import { AuthAccountService } from "./auth-account.service.js";
import type { RequestFingerprint } from "./auth.types.js";

const passwordCost = 12;
const refreshLifetimeMs = 30 * 24 * 60 * 60 * 1_000;
const lockThreshold = 10;
const lockDurationMs = 15 * 60 * 1_000;
const accountService = new AuthAccountService();

type IssuedSession = {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  expiresIn: number;
};

export class AuthService {
  async me(context: TenantContext) {
    const membership = await prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId: context.tenantId, userId: context.userId } },
      select: {
        role: true,
        mfaEnabled: true,
        user: { select: { id: true, email: true, fullName: true, isSuperAdmin: true, emailVerifiedAt: true } },
        tenant: { select: { id: true, name: true, slug: true, timezone: true } },
      },
    });
    if (!membership) throw unauthorized();
    return membership;
  }

  async register(input: RegisterInput, fingerprint: RequestFingerprint) {
    const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw conflict("Já existe uma conta com este e-mail");

    const passwordHash = await bcrypt.hash(input.password, passwordCost);
    const slug = `${slugify(input.companyName)}-${randomBytes(3).toString("hex")}`;

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: input.companyName, slug },
        select: { id: true, name: true, slug: true },
      });
      const user = await tx.user.create({
        data: { email: input.email, fullName: input.fullName, passwordHash },
        select: { id: true, email: true, fullName: true },
      });
      const membership = await tx.membership.create({
        data: { tenantId: tenant.id, userId: user.id, role: "OWNER" },
        select: { role: true },
      });
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorUserId: user.id,
          action: "auth.registered",
          resourceType: "user",
          resourceId: user.id,
          ipHash: fingerprint.ip ? keyedHash(fingerprint.ip) : null,
          userAgentHash: fingerprint.userAgent ? keyedHash(fingerprint.userAgent) : null,
        },
      });
      return { tenant, user, role: membership.role };
    });

    const session = await this.issueSession(
      result.user.id,
      result.tenant.id,
      result.role,
      fingerprint,
    );
    const verification = await accountService.deliverEmailVerification({
      userId: result.user.id,
      email: result.user.email,
      fullName: result.user.fullName,
    });
    return { ...result, session, emailVerification: verification };
  }

  async inspectInvitation(token: string) {
    const invitation = await prisma.teamInvitation.findUnique({
      where: { tokenHash: sha256(token) },
      select: {
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        tenant: { select: { name: true } },
      },
    });
    if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) {
      throw new AppError(410, "INVITATION_INVALID", "Convite inválido ou expirado");
    }
    const existing = await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
    return {
      tenantName: invitation.tenant.name,
      role: invitation.role,
      maskedEmail: maskEmail(invitation.email),
      requiresAccountCreation: !existing,
    };
  }

  async registerInvitation(input: InvitationRegisterInput, fingerprint: RequestFingerprint) {
    const invitation = await prisma.teamInvitation.findUnique({
      where: { tokenHash: sha256(input.token) },
      include: { tenant: { select: { id: true, name: true, slug: true, status: true } } },
    });
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date() ||
      invitation.tenant.status !== "ACTIVE"
    ) {
      throw new AppError(410, "INVITATION_INVALID", "Convite inválido ou expirado");
    }
    const existing = await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
    if (existing) throw conflict("Esta conta já existe. Entre para aceitar o convite");

    const passwordHash = await bcrypt.hash(input.password, passwordCost);
    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.teamInvitation.updateMany({
        where: {
          id: invitation.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count !== 1) throw new AppError(410, "INVITATION_INVALID", "Convite inválido ou expirado");
      const user = await tx.user.create({
        data: {
          email: invitation.email,
          fullName: input.fullName,
          passwordHash,
          emailVerifiedAt: new Date(),
        },
        select: { id: true, email: true, fullName: true },
      });
      const membership = await tx.membership.create({
        data: {
          tenantId: invitation.tenantId,
          userId: user.id,
          role: invitation.role,
        },
        select: { role: true },
      });
      await tx.auditLog.create({
        data: {
          tenantId: invitation.tenantId,
          actorUserId: user.id,
          action: "auth.invitation_registered",
          resourceType: "membership",
          resourceId: user.id,
          ipHash: fingerprint.ip ? keyedHash(fingerprint.ip) : null,
          userAgentHash: fingerprint.userAgent ? keyedHash(fingerprint.userAgent) : null,
        },
      });
      return { user, role: membership.role };
    });
    const session = await this.issueSession(
      result.user.id,
      invitation.tenantId,
      result.role,
      fingerprint,
    );
    return {
      ...result,
      tenant: {
        id: invitation.tenant.id,
        name: invitation.tenant.name,
        slug: invitation.tenant.slug,
      },
      session,
    };
  }

  async login(input: LoginInput, fingerprint: RequestFingerprint) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: {
        memberships: {
          where: { active: true, tenant: { status: "ACTIVE" } },
          select: { tenantId: true, role: true, mfaEnabled: true, tenant: { select: { id: true, name: true } } },
        },
      },
    });

    if (!user) {
      await bcrypt.hash(input.password, passwordCost);
      logger.warn(
        {
          emailHash: keyedHash(input.email),
          ipHash: fingerprint.ip ? keyedHash(fingerprint.ip) : undefined,
        },
        "Authentication failed",
      );
      throw unauthorized("E-mail ou senha inválidos");
    }

    if (user.status !== "ACTIVE" || (user.lockedUntil && user.lockedUntil > new Date())) {
      await this.auditLoginFailure(
        user.memberships.map((membership) => membership.tenantId),
        user.id,
        "ACCOUNT_UNAVAILABLE",
        fingerprint,
      );
      throw forbidden("Conta temporariamente indisponível");
    }

    const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordValid) {
      const failedLogins = user.failedLogins + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins,
          lockedUntil:
            failedLogins >= lockThreshold ? new Date(Date.now() + lockDurationMs) : null,
        },
      });
      await this.auditLoginFailure(
        user.memberships.map((membership) => membership.tenantId),
        user.id,
        "INVALID_CREDENTIALS",
        fingerprint,
      );
      throw unauthorized("E-mail ou senha inválidos");
    }

    if (user.memberships.length === 0) throw forbidden("Nenhuma empresa ativa vinculada à conta");
    if (!input.tenantId && user.memberships.length > 1) {
      return {
        requiresTenantSelection: true as const,
        tenants: user.memberships.map((membership) => membership.tenant),
      };
    }

    const membership = input.tenantId
      ? user.memberships.find((item) => item.tenantId === input.tenantId)
      : user.memberships[0];
    if (!membership) throw forbidden("Empresa não disponível para esta conta");

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    if (membership.mfaEnabled) {
      return {
        requiresMfa: true as const,
        challengeToken: signMfaChallenge({ sub: user.id, tenantId: membership.tenantId }),
      };
    }

    const session = await this.issueSession(user.id, membership.tenantId, membership.role, fingerprint);
    await this.audit(membership.tenantId, user.id, "auth.login", fingerprint);
    return {
      requiresMfa: false as const,
      user: { id: user.id, email: user.email, fullName: user.fullName },
      tenant: membership.tenant,
      role: membership.role,
      session,
    };
  }

  async completeMfaLogin(challengeToken: string, code: string, fingerprint: RequestFingerprint) {
    const challenge = verifyMfaChallenge(challengeToken);
    const [mfaSecret, membership, user] = await Promise.all([
      prisma.mfaSecret.findUnique({
        where: { tenantId_userId: { tenantId: challenge.tenantId, userId: challenge.sub } },
      }),
      prisma.membership.findUnique({
        where: { tenantId_userId: { tenantId: challenge.tenantId, userId: challenge.sub } },
      }),
      prisma.user.findUnique({ where: { id: challenge.sub } }),
    ]);

    if (!mfaSecret?.verifiedAt || !membership?.active || !membership.mfaEnabled || !user) {
      throw unauthorized("MFA indisponível para esta sessão");
    }

    const verified = verifyTotp(decryptSecret(mfaSecret.secretCiphertext), code);
    if (!verified.valid || verified.step === undefined) throw unauthorized("Código MFA inválido");
    if (mfaSecret.lastUsedStep !== null && verified.step <= mfaSecret.lastUsedStep) {
      throw unauthorized("Código MFA já utilizado");
    }

    await prisma.mfaSecret.update({
      where: { id: mfaSecret.id },
      data: { lastUsedStep: verified.step },
    });
    const session = await this.issueSession(user.id, challenge.tenantId, membership.role, fingerprint);
    await this.audit(challenge.tenantId, user.id, "auth.mfa_login", fingerprint);
    return {
      user: { id: user.id, email: user.email, fullName: user.fullName },
      tenantId: challenge.tenantId,
      role: membership.role,
      session,
    };
  }

  async refresh(
    refreshToken: string,
    csrfToken: string,
    fingerprint: RequestFingerprint,
  ): Promise<IssuedSession> {
    const tokenHash = sha256(refreshToken);
    const current = await prisma.refreshSession.findUnique({ where: { tokenHash } });
    if (!current) throw unauthorized("Sessão de atualização inválida");

    if (current.revokedAt) {
      await prisma.refreshSession.updateMany({
        where: { familyId: current.familyId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: "REUSE_DETECTED" },
      });
      throw unauthorized("Reutilização de token detectada; a sessão foi encerrada");
    }
    if (current.expiresAt <= new Date()) throw unauthorized("Sessão expirada");
    if (current.csrfHash !== sha256(csrfToken)) throw forbidden("Token CSRF inválido");

    const membership = await prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId: current.tenantId, userId: current.userId } },
      select: { active: true, role: true },
    });
    if (!membership?.active) throw forbidden("Associação com a empresa foi desativada");

    const nextRefreshToken = secureToken();
    const nextCsrfToken = secureToken(32);
    const nextId = randomUUID();
    const expiresAt = new Date(Date.now() + refreshLifetimeMs);

    await prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshSession.updateMany({
        where: { id: current.id, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokeReason: "ROTATED",
          lastUsedAt: new Date(),
          replacedByTokenId: nextId,
        },
      });
      if (revoked.count !== 1) throw unauthorized("Token de atualização já utilizado");

      await tx.refreshSession.create({
        data: {
          id: nextId,
          tenantId: current.tenantId,
          userId: current.userId,
          familyId: current.familyId,
          tokenHash: sha256(nextRefreshToken),
          csrfHash: sha256(nextCsrfToken),
          ipHash: fingerprint.ip ? keyedHash(fingerprint.ip) : null,
          userAgentHash: fingerprint.userAgent ? keyedHash(fingerprint.userAgent) : null,
          deviceLabel: describeDevice(fingerprint.userAgent),
          expiresAt,
        },
      });
    });

    return {
      accessToken: signAccessToken({
        sub: current.userId,
        tenantId: current.tenantId,
        role: membership.role,
      }),
      refreshToken: nextRefreshToken,
      csrfToken: nextCsrfToken,
      expiresIn: 900,
    };
  }

  async logout(
    refreshToken: string | undefined,
    context: TenantContext | undefined,
    fingerprint: RequestFingerprint,
  ): Promise<void> {
    if (refreshToken) {
      const tokenHash = sha256(refreshToken);
      await prisma.refreshSession.updateMany({
        where: {
          tokenHash,
          revokedAt: null,
          ...(context ? { tenantId: context.tenantId, userId: context.userId } : {}),
        },
        data: { revokedAt: new Date(), revokeReason: "LOGOUT" },
      });
    }
    if (context) {
      await this.audit(context.tenantId, context.userId, "auth.logout", fingerprint);
    }
  }

  async beginMfaSetup(context: TenantContext) {
    const user = await prisma.user.findUnique({
      where: { id: context.userId },
      select: { email: true },
    });
    if (!user) throw unauthorized();
    const secret = generateTotpSecret();
    await prisma.$transaction(async (tx) => {
      await tx.mfaSecret.upsert({
        where: { tenantId_userId: { tenantId: context.tenantId, userId: context.userId } },
        create: {
          tenantId: context.tenantId,
          userId: context.userId,
          secretCiphertext: encryptSecret(secret),
        },
        update: {
          secretCiphertext: encryptSecret(secret),
          verifiedAt: null,
          lastUsedStep: null,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          actorUserId: context.userId,
          action: "auth.mfa_setup_started",
          resourceType: "user",
          resourceId: context.userId,
        },
      });
    });
    return { secret, otpauthUri: totpUri({ secret, email: user.email }) };
  }

  async confirmMfa(context: TenantContext, code: string): Promise<void> {
    const record = await prisma.mfaSecret.findUnique({
      where: { tenantId_userId: { tenantId: context.tenantId, userId: context.userId } },
    });
    if (!record) throw unauthorized("Configuração MFA não iniciada");
    const result = verifyTotp(decryptSecret(record.secretCiphertext), code);
    if (!result.valid || result.step === undefined) throw unauthorized("Código MFA inválido");

    await prisma.$transaction([
      prisma.mfaSecret.update({
        where: { id: record.id },
        data: { verifiedAt: new Date(), lastUsedStep: result.step },
      }),
      prisma.membership.update({
        where: { tenantId_userId: { tenantId: context.tenantId, userId: context.userId } },
        data: { mfaEnabled: true },
      }),
      prisma.auditLog.create({
        data: {
          tenantId: context.tenantId,
          actorUserId: context.userId,
          action: "auth.mfa_enabled",
          resourceType: "user",
          resourceId: context.userId,
        },
      }),
    ]);
  }

  private async issueSession(
    userId: string,
    tenantId: string,
    role: MembershipRole,
    fingerprint: RequestFingerprint,
  ): Promise<IssuedSession> {
    const refreshToken = secureToken();
    const csrfToken = secureToken(32);
    const expiresAt = new Date(Date.now() + refreshLifetimeMs);

    await prisma.$transaction([
      prisma.refreshSession.create({
        data: {
          tenantId,
          userId,
          familyId: randomUUID(),
          tokenHash: sha256(refreshToken),
          csrfHash: sha256(csrfToken),
          ipHash: fingerprint.ip ? keyedHash(fingerprint.ip) : null,
          userAgentHash: fingerprint.userAgent ? keyedHash(fingerprint.userAgent) : null,
          deviceLabel: describeDevice(fingerprint.userAgent),
          expiresAt,
        },
      }),
      prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } }),
    ]);

    return {
      accessToken: signAccessToken({ sub: userId, tenantId, role }),
      refreshToken,
      csrfToken,
      expiresIn: 900,
    };
  }

  private async audit(
    tenantId: string,
    actorUserId: string,
    action: string,
    fingerprint: RequestFingerprint,
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action,
        resourceType: "session",
        ipHash: fingerprint.ip ? keyedHash(fingerprint.ip) : null,
        userAgentHash: fingerprint.userAgent ? keyedHash(fingerprint.userAgent) : null,
      },
    });
  }

  private async auditLoginFailure(
    tenantIds: string[],
    actorUserId: string,
    reason: string,
    fingerprint: RequestFingerprint,
  ): Promise<void> {
    logger.warn(
      {
        userId: actorUserId,
        reason,
        ipHash: fingerprint.ip ? keyedHash(fingerprint.ip) : undefined,
      },
      "Authentication failed",
    );
    if (tenantIds.length === 0) return;
    await prisma.auditLog.createMany({
      data: tenantIds.map((tenantId) => ({
        tenantId,
        actorUserId,
        action: "auth.login_failed",
        resourceType: "session",
        ipHash: fingerprint.ip ? keyedHash(fingerprint.ip) : null,
        userAgentHash: fingerprint.userAgent ? keyedHash(fingerprint.userAgent) : null,
        metadata: { reason },
      })),
    });
  }
}

function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "")
      .slice(0, 60) || "empresa"
  );
}

export function describeDevice(userAgent?: string): string | null {
  if (!userAgent) return null;
  const browser = /Edg\//u.test(userAgent)
    ? "Edge"
    : /Firefox\//u.test(userAgent)
      ? "Firefox"
      : /Chrome\//u.test(userAgent)
        ? "Chrome"
        : /Safari\//u.test(userAgent)
          ? "Safari"
          : "Navegador";
  const platform = /Android/u.test(userAgent)
    ? "Android"
    : /iPhone|iPad/u.test(userAgent)
      ? "iOS"
      : /Windows/u.test(userAgent)
        ? "Windows"
        : /Macintosh/u.test(userAgent)
          ? "macOS"
          : /Linux/u.test(userAgent)
            ? "Linux"
            : "dispositivo desconhecido";
  return `${browser} em ${platform}`;
}

export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}
