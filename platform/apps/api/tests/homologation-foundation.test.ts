import { describe, expect, it, vi } from "vitest";
import { requireExternalIntegrations } from "../src/core/http/external-integrations.js";
import { readinessState } from "../src/modules/health/health.routes.js";
import { hasPlatformOwnerAccess } from "../src/modules/super-admin/super-admin.middleware.js";

describe("fundação de homologação", () => {
  it("considera PostgreSQL obrigatório e Redis desativado nesta fase", () => {
    expect(readinessState(true, "disabled")).toEqual({ statusCode: 200, status: "ready" });
    expect(readinessState(false, "disabled")).toEqual({ statusCode: 503, status: "not_ready" });
  });

  it("bloqueia chamadas externas quando a chave geral está desligada", () => {
    const next = vi.fn();
    requireExternalIntegrations({} as never, {} as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      code: "EXTERNAL_INTEGRATIONS_DISABLED",
      statusCode: 503,
    }));
  });

  it("não confunde administrador de empresa com Platform Owner", () => {
    expect(hasPlatformOwnerAccess(null)).toBe(false);
    expect(hasPlatformOwnerAccess({ active: true, role: "ADMIN", user: { status: "ACTIVE" } })).toBe(false);
    expect(hasPlatformOwnerAccess({ active: true, role: "OWNER", user: { status: "ACTIVE" } })).toBe(true);
    expect(hasPlatformOwnerAccess({ active: false, role: "OWNER", user: { status: "ACTIVE" } })).toBe(false);
  });
});
