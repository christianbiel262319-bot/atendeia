import { describe, expect, it } from "vitest";
import { parseEnvironment } from "../src/config/env.js";

describe("environment configuration", () => {
  it("starts the platform without optional external provider credentials", () => {
    const parsed = parseEnvironment({
      ...process.env,
      REDIS_URL: "",
      META_APP_SECRET: "",
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: "",
      OPENAI_API_KEY: "",
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
      MERCADO_PAGO_ACCESS_TOKEN: "",
      MERCADO_PAGO_WEBHOOK_SECRET: "",
      ASAAS_API_KEY: "",
      ASAAS_WEBHOOK_TOKEN: "",
      CLOUDINARY_CLOUD_NAME: "",
      CLOUDINARY_API_KEY: "",
      CLOUDINARY_API_SECRET: "",
    });

    expect(parsed.META_APP_SECRET).toBeUndefined();
    expect(parsed.OPENAI_API_KEY).toBeUndefined();
    expect(parsed.STRIPE_SECRET_KEY).toBeUndefined();
    expect(parsed.REDIS_URL).toBeUndefined();
    expect(parsed.EXTERNAL_INTEGRATIONS_ENABLED).toBe(false);
  });

  it("exige Redis somente quando integrações externas forem habilitadas", () => {
    expect(() => parseEnvironment({
      ...process.env,
      EXTERNAL_INTEGRATIONS_ENABLED: "true",
      REDIS_URL: "",
    })).toThrow(/REDIS_URL/u);
  });

  it("rejeita cookie inseguro quando o estágio é produção", () => {
    expect(() => parseEnvironment({
      ...process.env,
      ATENDEIA_DEPLOYMENT_STAGE: "production",
      COOKIE_SECURE: "false",
    })).toThrow(/COOKIE_SECURE/u);
  });
});
