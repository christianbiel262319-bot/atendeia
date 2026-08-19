import { describe, expect, it } from "vitest";
import { parseEnvironment } from "../src/config/env.js";

describe("environment configuration", () => {
  it("starts the platform without optional external provider credentials", () => {
    const parsed = parseEnvironment({
      ...process.env,
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
  });
});
