import { describe, expect, it, vi } from "vitest";
import { apiRequest, decodeAccessToken, setApiSession } from "./api";

describe("access token parsing", () => {
  it("reads the tenant context from a JWT payload", () => {
    const payload = btoa(JSON.stringify({ sub: "user-1", tenantId: "tenant-1", role: "OWNER" }));
    expect(decodeAccessToken(`header.${payload}.signature`)).toEqual({
      sub: "user-1",
      tenantId: "tenant-1",
      role: "OWNER",
    });
  });

  it("continua exigindo autenticação real sem uma sessão DEMO autorizada", async () => {
    setApiSession(null);
    await expect(apiRequest("/v1/auth/me", { authenticated: true })).rejects.toEqual(expect.objectContaining({
      code: "NO_SESSION",
      status: 401,
    }));
  });

  it("não ativa dados DEMO quando a infraestrutura real está indisponível", async () => {
    const originalFetch = globalThis.fetch;
    const unavailableFetch = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
    globalThis.fetch = unavailableFetch;

    try {
      await expect(apiRequest("/health/ready")).rejects.toThrow("Failed to fetch");
      expect(unavailableFetch).toHaveBeenCalledOnce();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
