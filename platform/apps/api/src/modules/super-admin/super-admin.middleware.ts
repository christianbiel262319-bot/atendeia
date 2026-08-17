import type { NextFunction, Request, Response } from "express";
import { forbidden } from "../../core/errors/app-error.js";
import { prisma } from "../../infra/database/prisma.js";

export async function requireSuperAdmin(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = request.tenant
      ? await prisma.user.findUnique({
          where: { id: request.tenant.userId },
          select: { isSuperAdmin: true, status: true },
        })
      : null;
    if (!user?.isSuperAdmin || user.status !== "ACTIVE") {
      throw forbidden("Acesso restrito à administração da plataforma");
    }
    next();
  } catch (error) {
    next(error);
  }
}
