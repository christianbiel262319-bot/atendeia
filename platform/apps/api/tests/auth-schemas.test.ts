import { describe, expect, it } from "vitest";
import { registerSchema } from "../src/modules/auth/auth.schemas.js";

describe("auth validation", () => {
  it("normalizes e-mail and accepts a strong password", () => {
    const result = registerSchema.parse({
      companyName: "Empresa",
      fullName: "Responsável",
      email: "PESSOA@EXEMPLO.COM",
      password: "Senha-forte-2026!",
    });
    expect(result.email).toBe("pessoa@exemplo.com");
  });

  it("rejects weak passwords", () => {
    expect(() =>
      registerSchema.parse({
        companyName: "Empresa",
        fullName: "Responsável",
        email: "pessoa@exemplo.com",
        password: "123456",
      }),
    ).toThrow();
  });
});
