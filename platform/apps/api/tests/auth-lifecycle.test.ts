import { describe, expect, it } from "vitest";
import { escapeHtml } from "../src/infra/email/transactional-email.js";
import {
  changePasswordSchema,
  invitationRegisterSchema,
  resetPasswordSchema,
} from "../src/modules/auth/auth.schemas.js";
import { describeDevice, maskEmail } from "../src/modules/auth/auth.service.js";
import { isValidTimeZone } from "../src/modules/tenants/tenant.schemas.js";
import { signAccessToken, verifyAccessToken } from "../src/core/security/jwt.js";

describe("ciclo de autenticação", () => {
  it("mascara o destinatário de convites", () => {
    expect(maskEmail("proprietario@empresa.com")).toBe("pr**********@empresa.com");
    expect(maskEmail("a@empresa.com")).toBe("a***@empresa.com");
  });

  it("cria um rótulo de dispositivo sem armazenar o user-agent completo", () => {
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0) Chrome/140.0")).toBe("Chrome em Windows");
    expect(describeDevice("Mozilla/5.0 (iPhone) Version/18.0 Mobile Safari/605.1")).toBe("Safari em iOS");
    expect(describeDevice()).toBeNull();
  });

  it("aplica a mesma política forte na redefinição e no cadastro por convite", () => {
    const strong = "Senha-Forte-2026!";
    expect(resetPasswordSchema.safeParse({ token: "x".repeat(48), password: strong }).success).toBe(true);
    expect(invitationRegisterSchema.safeParse({ token: "x".repeat(48), fullName: "Ana Silva", password: strong }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ token: "x".repeat(48), password: "fraca" }).success).toBe(false);
  });

  it("impede reutilizar a senha atual como nova senha", () => {
    const value = "Senha-Forte-2026!";
    expect(changePasswordSchema.safeParse({ currentPassword: value, newPassword: value }).success).toBe(false);
  });

  it("valida fusos reais e rejeita identificadores arbitrários", () => {
    expect(isValidTimeZone("America/Sao_Paulo")).toBe(true);
    expect(isValidTimeZone("Tenant/Inventado")).toBe(false);
  });

  it("escapa conteúdo inserido em e-mail HTML", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  it("vincula o access token a uma sessão persistida", () => {
    const token = signAccessToken({
      sub: "10000000-0000-4000-8000-000000000001",
      tenantId: "00000000-0000-4000-8000-000000000001",
      sid: "90000000-0000-4000-8000-000000000001",
      role: "OWNER",
    });
    expect(verifyAccessToken(token).sid).toBe("90000000-0000-4000-8000-000000000001");
  });
});
