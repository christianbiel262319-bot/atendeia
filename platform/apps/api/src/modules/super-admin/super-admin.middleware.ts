import type { NextFunction, Request, Response } from "express";
import { forbidden } from "../../core/errors/app-error.js";
import { prisma } from "../../infra/database/prisma.js";

export async function requireSuperAdmin(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const membership = request.tenant
      ? await prisma.platformMembership.findUnique({
          where: { userId: request.tenant.userId },
          select: { active: true, role: true, user: { select: { status: true } } },
        })
      : null;
    if (!hasPlatformOwnerAccess(membership)) {
      throw forbidden("Acesso restrito à administração da plataforma");
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function hasPlatformOwnerAccess(
  membership: { active: boolean; role: string; user: { status: string } } | null,
): boolean {
  return Boolean(
    membership?.active &&
    membership.role === "OWNER" &&
    membership.user.status === "ACTIVE",
  );
}
