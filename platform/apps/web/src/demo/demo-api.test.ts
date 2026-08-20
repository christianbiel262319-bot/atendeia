import { describe, expect, it } from "vitest";
import { demoApiRequest } from "./demo-api";
import type { DemoBackendRequiredError } from "./demo-api";
import { DEMO_BACKEND_MESSAGE } from "./demo-mode";

describe("API local do modo demonstração", () => {
  it("fornece dados identificados como DEMO para leitura", async () => {
    const result = await demoApiRequest<{ data: { items: Array<{ displayName: string | null; tags: string[] }> } }>("/v1/crm/contacts?archived=false");
    expect(result.data.items.length).toBeGreaterThan(0);
    expect(result.data.items.every((item) => item.displayName?.includes("DEMO") && item.tags.includes("DEMO"))).toBe(true);
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
});
