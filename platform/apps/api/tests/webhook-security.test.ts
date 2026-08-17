import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyMetaSignature } from "../src/modules/whatsapp/webhook-security.js";

describe("Meta webhook signature", () => {
  it("accepts the exact HMAC and rejects altered payloads", () => {
    const body = Buffer.from('{"event":"message"}');
    const secret = "integration-test-secret";
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(verifyMetaSignature(body, signature, secret)).toBe(true);
    expect(verifyMetaSignature(Buffer.from('{"event":"changed"}'), signature, secret)).toBe(false);
  });
});
