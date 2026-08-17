import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  secureToken,
  sha256,
} from "../src/core/security/crypto.js";

describe("secret protection", () => {
  it("encrypts with a randomized authenticated payload", () => {
    const first = encryptSecret("segredo-real");
    const second = encryptSecret("segredo-real");
    expect(first).not.toBe(second);
    expect(decryptSecret(first)).toBe("segredo-real");
  });

  it("creates opaque tokens and deterministic hashes", () => {
    const token = secureToken();
    expect(token.length).toBeGreaterThan(40);
    expect(sha256(token)).toHaveLength(64);
    expect(sha256(token)).toBe(sha256(token));
  });
});
