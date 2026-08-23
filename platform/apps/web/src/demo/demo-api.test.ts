import { describe, expect, it } from "vitest";
import { demoApiRequest } from "./demo-api";
import type { DemoBackendRequiredError } from "./demo-api";
import { DEMO_BACKEND_MESSAGE } from "./demo-mode";

describe("API local do modo demonstração", () => {
  it("fornece dados identificados como DEMO para leitura", async () => {
    const result = await demoApiRequest<{ data: { items: Array<{ displayName: string | null; phoneE164: string; tags: string[] }> } }>("/v1/crm/contacts?archived=false");
    expect(result.data.items.length).toBeGreaterThan(0);
    expect(result.data.items.every((item) => item.displayName?.includes("DEMO") && item.tags.includes("DEMO"))).toBe(true);
    expect(result.data.items.every((item) => item.phoneE164.startsWith("+5500"))).toBe(true);
  });

  it("mantém o checklist DEMO coerente com as quatro condições exibidas", async () => {
    const result = await demoApiRequest<{ data: { onboarding: { steps: Record<string, boolean>; completed: number; total: number } } }>("/v1/dashboard/summary");
    expect(result.data.onboarding.completed).toBe(Object.values(result.data.onboarding.steps).filter(Boolean).length);
    expect(result.data.onboarding.total).toBe(Object.keys(result.data.onboarding.steps).length);
  });

  it("mantém MFA e sessões DEMO coerentes com o perfil demonstrativo", async () => {
    const [team, sessions] = await Promise.all([
      demoApiRequest<{ data: Array<{ user: { id: string }; mfaEnabled: boolean }> }>("/v1/team"),
      demoApiRequest<{ data: Array<{ current: boolean; expiresAt: string }> }>("/v1/auth/sessions"),
    ]);
    const administrator = team.data.find((member) => member.user.id === "00000000-0000-4000-8000-00000000d001");
    expect(administrator?.mfaEnabled).toBe(false);
    expect(sessions.data.filter((session) => session.current)).toHaveLength(1);
    expect(sessions.data.every((session) => Date.parse(session.expiresAt) > Date.parse("2026-08-23T00:00:00.000Z"))).toBe(true);
  });

  it("mantém filtros visuais utilizáveis", async () => {
    const result = await demoApiRequest<{ data: Array<{ status: string }> }>("/v1/conversations?status=RESOLVED");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.status).toBe("RESOLVED");
  });

  it("bloqueia qualquer mutação que dependeria do backend", async () => {
    await expect(demoApiRequest("/v1/crm/contacts", { method: "POST" })).rejects.toEqual(expect.objectContaining<Partial<DemoBackendRequiredError>>({
      code: "DEMO_BACKEND_REQUIRED",
      message: DEMO_BACKEND_MESSAGE,
      status: 503,
    }));
  });

  it("carrega a navegação demonstrativa sem consultar infraestrutura externa", async () => {
    const originalFetch = globalThis.fetch;
    let externalRequests = 0;
    globalThis.fetch = () => {
      externalRequests += 1;
      return Promise.reject(new Error("A infraestrutura externa não deveria ser consultada"));
    };

    try {
      const [dashboard, conversations, team, plans] = await Promise.all([
        demoApiRequest<{ data: { conversations: number } }>("/v1/dashboard/summary"),
        demoApiRequest<{ data: Array<{ id: string }> }>("/v1/conversations"),
        demoApiRequest<{ data: Array<{ id: string }> }>("/v1/team"),
        demoApiRequest<{ data: Array<{ id: string }> }>("/v1/billing/plans"),
      ]);

      expect(dashboard.data.conversations).toBeGreaterThan(0);
      expect(conversations.data.length).toBeGreaterThan(0);
      expect(team.data.length).toBeGreaterThan(0);
      expect(plans.data.length).toBeGreaterThan(0);
      expect(externalRequests).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
