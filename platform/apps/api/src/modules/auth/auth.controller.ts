import type { CookieOptions, Request, Response } from "express";
import { env } from "../../config/env.js";
import { assertCsrf } from "../../core/security/csrf.js";
import { AuthService } from "./auth.service.js";
import {
  loginSchema,
  mfaConfirmSchema,
  mfaLoginSchema,
  registerSchema,
} from "./auth.schemas.js";

const service = new AuthService();
const refreshCookie = "atendeia.refresh";
const csrfCookie = "atendeia.csrf";

const sharedCookieOptions: CookieOptions = {
  secure: env.COOKIE_SECURE,
  sameSite: "strict",
  maxAge: 30 * 24 * 60 * 60 * 1_000,
};

export class AuthController {
  async me(request: Request, response: Response): Promise<void> {
    const profile = await service.me(request.tenant!);
    response.json({ data: profile });
  }

  async register(request: Request, response: Response): Promise<void> {
    const input = registerSchema.parse(request.body);
    const result = await service.register(input, fingerprint(request));
    const publicSession = setSessionCookies(response, result.session);
    response.status(201).json({
      data: {
        user: result.user,
        tenant: result.tenant,
        role: result.role,
        session: publicSession,
      },
    });
  }

  async login(request: Request, response: Response): Promise<void> {
    const input = loginSchema.parse(request.body);
    const result = await service.login(input, fingerprint(request));

    if ("requiresTenantSelection" in result) {
      response.status(200).json({ data: result });
      return;
    }
    if (result.requiresMfa) {
      response.status(200).json({ data: result });
      return;
    }

    const publicSession = setSessionCookies(response, result.session);
    response.json({ data: { ...result, session: publicSession } });
  }

  async completeMfaLogin(request: Request, response: Response): Promise<void> {
    const input = mfaLoginSchema.parse(request.body);
    const result = await service.completeMfaLogin(
      input.challengeToken,
      input.code,
      fingerprint(request),
    );
    const publicSession = setSessionCookies(response, result.session);
    response.json({ data: { ...result, session: publicSession } });
  }

  async refresh(request: Request, response: Response): Promise<void> {
    assertCsrf(request);
    const token = request.cookies?.[refreshCookie] as string | undefined;
    const csrfToken = request.get("x-csrf-token");
    if (!token || !csrfToken) {
      response.status(401).json({ error: { code: "UNAUTHORIZED", message: "Sessão ausente" } });
      return;
    }
    const session = await service.refresh(token, csrfToken, fingerprint(request));
    const publicSession = setSessionCookies(response, session);
    response.json({ data: { session: publicSession } });
  }

  async logout(request: Request, response: Response): Promise<void> {
    assertCsrf(request);
    await service.logout(
      request.cookies?.[refreshCookie] as string | undefined,
      request.tenant,
      fingerprint(request),
    );
    clearSessionCookies(response);
    response.status(204).send();
  }

  async beginMfaSetup(request: Request, response: Response): Promise<void> {
    const setup = await service.beginMfaSetup(request.tenant!);
    response.json({ data: setup });
  }

  async confirmMfa(request: Request, response: Response): Promise<void> {
    const { code } = mfaConfirmSchema.parse(request.body);
    await service.confirmMfa(request.tenant!, code);
    response.status(204).send();
  }
}

function fingerprint(request: Request): { ip?: string; userAgent?: string } {
  const userAgent = request.get("user-agent");
  return {
    ...(request.ip ? { ip: request.ip } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
}

function setSessionCookies(
  response: Response,
  session: { accessToken: string; refreshToken: string; csrfToken: string; expiresIn: number },
) {
  response.cookie(refreshCookie, session.refreshToken, {
    ...sharedCookieOptions,
    path: "/v1/auth",
    httpOnly: true,
  });
  response.cookie(csrfCookie, session.csrfToken, {
    ...sharedCookieOptions,
    path: "/",
    httpOnly: false,
  });
  return {
    accessToken: session.accessToken,
    csrfToken: session.csrfToken,
    expiresIn: session.expiresIn,
  };
}

function clearSessionCookies(response: Response): void {
  response.clearCookie(refreshCookie, { ...sharedCookieOptions, path: "/v1/auth", httpOnly: true });
  response.clearCookie(csrfCookie, { ...sharedCookieOptions, path: "/", httpOnly: false });
}
