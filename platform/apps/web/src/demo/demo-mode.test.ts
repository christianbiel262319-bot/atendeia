import { describe, expect, it } from "vitest";
import { canEnableDemoMode } from "./demo-mode";

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
});
