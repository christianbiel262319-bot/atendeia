import { describe, expect, it } from "vitest";
import { canEnableDemoMode, createAuthorizedDemoSession, hasAuthorizedDemoSession } from "./demo-mode";

function memoryStore() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("proteção do modo demonstração", () => {
  it("permite o modo em desenvolvimento", () => {
    expect(canEnableDemoMode({ development: true, stage: "development" })).toBe(true);
  });

  it("exige estágio e flag explícitos na build de preview", () => {
    expect(canEnableDemoMode({ development: false, stage: "preview", previewFlag: "true" })).toBe(true);
    expect(canEnableDemoMode({ development: false, stage: "preview", previewFlag: "false" })).toBe(false);
    expect(canEnableDemoMode({ development: false, stage: "preview" })).toBe(false);
  });

  it("nunca libera o bypass na produção", () => {
    expect(canEnableDemoMode({ development: false, stage: "production", previewFlag: "true" })).toBe(false);
    expect(canEnableDemoMode({ development: false, stage: "production", previewFlag: "false" })).toBe(false);
  });

  it("inicia uma sessão DEMO somente após autorização explícita", () => {
    const storage = memoryStore();
    createAuthorizedDemoSession(true, storage);
    expect(hasAuthorizedDemoSession(true, storage)).toBe(true);
  });

  it("rejeita a entrada e ignora uma marca manual de sessão em produção", () => {
    const storage = memoryStore();
    storage.setItem("atendeia.preview.demo-session", "active");

    expect(hasAuthorizedDemoSession(false, storage)).toBe(false);
    expect(() => createAuthorizedDemoSession(false, storage)).toThrow("não está disponível nesta build");
  });
});
