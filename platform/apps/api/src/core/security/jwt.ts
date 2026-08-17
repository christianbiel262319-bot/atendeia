import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { unauthorized } from "../errors/app-error.js";

export type AccessTokenPayload = {
  sub: string;
  tenantId: string;
  role: string;
  type: "access";
  exp: number;
};

export type MfaChallengePayload = {
  sub: string;
  tenantId: string;
  type: "mfa_challenge";
};

const commonSignOptions: jwt.SignOptions = {
  algorithm: "HS256",
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
};

export function signAccessToken(payload: Omit<AccessTokenPayload, "type" | "exp">): string {
  return jwt.sign({ ...payload, type: "access" }, env.JWT_ACCESS_SECRET, {
    ...commonSignOptions,
    expiresIn: "15m",
  });
}

export function signMfaChallenge(payload: Omit<MfaChallengePayload, "type">): string {
  return jwt.sign({ ...payload, type: "mfa_challenge" }, env.JWT_ACCESS_SECRET, {
    ...commonSignOptions,
    expiresIn: "5m",
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = verify(token);
  if (
    payload.type !== "access" ||
    typeof payload.sub !== "string" ||
    typeof payload.tenantId !== "string" ||
    typeof payload.role !== "string" ||
    typeof payload.exp !== "number"
  ) {
    throw unauthorized("Token de acesso inválido");
  }
  return payload as unknown as AccessTokenPayload;
}

export function verifyMfaChallenge(token: string): MfaChallengePayload {
  const payload = verify(token);
  if (
    payload.type !== "mfa_challenge" ||
    typeof payload.sub !== "string" ||
    typeof payload.tenantId !== "string"
  ) {
    throw unauthorized("Desafio de MFA inválido");
  }
  return payload as unknown as MfaChallengePayload;
}

function verify(token: string): jwt.JwtPayload {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ["HS256"],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
    if (typeof payload === "string") throw new Error("Unexpected JWT payload");
    return payload;
  } catch {
    throw unauthorized("Token inválido ou expirado");
  }
}
