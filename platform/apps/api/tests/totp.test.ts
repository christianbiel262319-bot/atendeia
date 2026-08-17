import { describe, expect, it } from "vitest";
import { totpAt, verifyTotp } from "../src/core/security/totp.js";

describe("TOTP", () => {
  it("matches the RFC 6238 SHA-1 vector truncated to six digits", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(totpAt(secret, 59_000).code).toBe("287082");
  });

  it("accepts the current step and rejects malformed codes", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const { code, step } = totpAt(secret, 1_700_000_000_000);
    expect(verifyTotp(secret, code, 1_700_000_000_000)).toEqual({ valid: true, step });
    expect(verifyTotp(secret, "12ab56", 1_700_000_000_000)).toEqual({ valid: false });
  });
});
