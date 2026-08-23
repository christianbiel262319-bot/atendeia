import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../infra/database/prisma.js";
import { unauthorized, forbidden } from "../../core/errors/app-error.js";
import { verifyAccessToken } from "../../core/security/jwt.js";
import { assertTenantMatch } from "../../core/tenant/tenant-context.js";
import type { MembershipRole } from "../../generated/prisma/enums.js";

export async function requireTenant(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authorization = request.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      throw unauthorized("Token de acesso ausente");
    }

    const payload = verifyAccessToken(authorization.slice(7));
    const tenantId = assertTenantMatch(payload.tenantId, request.get("x-tenant-id") ?? undefined);

    const [membership, session] = await Promise.all([
      prisma.membership.findUnique({
        where: { tenantId_userId: { tenantId, userId: payload.sub } },
        select: { active: true, role: true, tenant: { select: { status: true } } },
      }),
      prisma.refreshSession.findFirst({
        where: {
          id: payload.sid,
          tenantId,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      }),
    ]);

    if (!session) throw unauthorized("Sessão revogada ou expirada");
    if (!membership?.active || membership.tenant.status !== "ACTIVE") {
      throw forbidden("Usuário sem associação ativa com a empresa");
    }

    request.tenant = { tenantId, userId: payload.sub, role: membership.role };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRoles(...roles: MembershipRole[]) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!request.tenant || !roles.includes(request.tenant.role)) {
      next(forbidden("Seu perfil não possui permissão para esta ação"));
      return;
    }
    next();
  };
}
