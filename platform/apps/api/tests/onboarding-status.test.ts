import { describe, expect, it } from "vitest";
import { calculateOnboardingStatus } from "../src/modules/tenants/tenant.service.js";

describe("status dos primeiros passos", () => {
  it("conta somente as condições realmente concluídas", () => {
    const result = calculateOnboardingStatus({ whatsapp: false, knowledge: true, ai: true, team: false });

    expect(result).toEqual({
      steps: { whatsapp: false, knowledge: true, ai: true, team: false },
      completed: 2,
      total: 4,
    });
  });

  it("não considera uma etapa por consequência de outra", () => {
    const result = calculateOnboardingStatus({ whatsapp: true, knowledge: false, ai: false, team: true });

    expect(result.completed).toBe(2);
    expect(result.steps.knowledge).toBe(false);
    expect(result.steps.ai).toBe(false);
  });
});
