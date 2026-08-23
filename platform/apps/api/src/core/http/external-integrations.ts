import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";

export function requireExternalIntegrations(
  _request: Request,
  _response: Response,
  next: NextFunction,
): void {
  if (!env.EXTERNAL_INTEGRATIONS_ENABLED) {
    next(new AppError(
      503,
      "EXTERNAL_INTEGRATIONS_DISABLED",
      "Integrações externas estão desativadas neste ambiente",
    ));
    return;
  }
  next();
}
