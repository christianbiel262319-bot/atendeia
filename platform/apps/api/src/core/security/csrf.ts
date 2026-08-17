import type { Request } from "express";
import { forbidden } from "../errors/app-error.js";
import { constantTimeEqual, sha256 } from "./crypto.js";

export function assertCsrf(request: Request): void {
  const cookieToken = request.cookies?.["atendeia.csrf"] as string | undefined;
  const headerToken = request.get("x-csrf-token");
  if (!cookieToken || !headerToken || !constantTimeEqual(sha256(cookieToken), sha256(headerToken))) {
    throw forbidden("Validação CSRF falhou");
  }
}
