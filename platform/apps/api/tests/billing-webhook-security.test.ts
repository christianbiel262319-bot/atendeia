import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  verifyMercadoPagoWebhook,
  verifyStripeWebhook,
} from "../src/modules/billing/webhook-security.js";

describe("billing webhook replay protection", () => {
  it("validates a Stripe signature only inside the allowed time window", () => {
    const nowMs = 1_800_000_000_000;
    const timestamp = String(nowMs / 1_000);
    const body = Buffer.from('{"id":"evt_1"}');
    const secret = "whsec_test_only_123456789";
    const signature = createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest("hex");
    expect(verifyStripeWebhook(body, `t=${timestamp},v1=${signature}`, secret, nowMs)).toBe(true);
    expect(verifyStripeWebhook(body, `t=${timestamp},v1=${signature}`, secret, nowMs + 301_000)).toBe(false);
    expect(verifyStripeWebhook(Buffer.from("changed"), `t=${timestamp},v1=${signature}`, secret, nowMs)).toBe(false);
  });

  it("validates Mercado Pago using data id, request id and timestamp", () => {
    const nowMs = 1_800_000_000_000;
    const timestamp = String(nowMs);
    const secret = "mp_test_only_123456789";
    const manifest = `id:payment-1;request-id:req-1;ts:${timestamp};`;
    const signature = createHmac("sha256", secret).update(manifest).digest("hex");
    expect(verifyMercadoPagoWebhook({
      dataId: "PAYMENT-1",
      requestId: "req-1",
      signatureHeader: `ts=${timestamp},v1=${signature}`,
      secret,
      nowMs,
    })).toBe(true);
    expect(verifyMercadoPagoWebhook({
      dataId: "PAYMENT-2",
      requestId: "req-1",
      signatureHeader: `ts=${timestamp},v1=${signature}`,
      secret,
      nowMs,
    })).toBe(false);
  });
});
