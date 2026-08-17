import { createHmac, randomBytes } from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const periodSeconds = 30;
const digits = 6;

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function totpAt(secret: string, timestampMs = Date.now()): { code: string; step: bigint } {
  const step = BigInt(Math.floor(timestampMs / 1000 / periodSeconds));
  return { code: hotp(secret, step), step };
}

export function verifyTotp(
  secret: string,
  candidate: string,
  timestampMs = Date.now(),
  window = 1,
): { valid: boolean; step?: bigint } {
  if (!/^\d{6}$/.test(candidate)) return { valid: false };

  const currentStep = BigInt(Math.floor(timestampMs / 1000 / periodSeconds));
  for (let offset = -window; offset <= window; offset += 1) {
    const step = currentStep + BigInt(offset);
    if (hotp(secret, step) === candidate) return { valid: true, step };
  }
  return { valid: false };
}

export function totpUri(input: { secret: string; email: string; issuer?: string }): string {
  const issuer = input.issuer ?? "AtendeIA";
  const label = encodeURIComponent(`${issuer}:${input.email}`);
  const params = new URLSearchParams({
    secret: input.secret,
    issuer,
    algorithm: "SHA1",
    digits: String(digits),
    period: String(periodSeconds),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function hotp(secret: string, counter: bigint): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    (((digest[offset] ?? 0) & 0x7f) << 24) |
    (((digest[offset + 1] ?? 0) & 0xff) << 16) |
    (((digest[offset + 2] ?? 0) & 0xff) << 8) |
    ((digest[offset + 3] ?? 0) & 0xff);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

function encodeBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(input: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const character of input.toUpperCase().replace(/=+$/u, "")) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Segredo TOTP inválido");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
