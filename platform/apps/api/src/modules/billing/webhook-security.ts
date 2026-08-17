import { createHmac, timingSafeEqual } from "node:crypto";

const defaultToleranceSeconds = 300;

export function verifyStripeWebhook(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
  nowMs = Date.now(),
): boolean {
  const parts = parseSignatureParts(signatureHeader);
  const timestamp = parts.get("t")?.[0];
  const signatures = parts.get("v1") ?? [];
  if (!timestamp || signatures.length === 0 || !/^\d+$/u.test(timestamp)) return false;
  if (Math.abs(nowMs / 1_000 - Number(timestamp)) > defaultToleranceSeconds) return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest("hex");
  return signatures.some((signature) => safeHexEqual(expected, signature));
}

export function verifyMercadoPagoWebhook(input: {
  dataId: string;
  requestId: string | undefined;
  signatureHeader: string | undefined;
  secret: string;
  nowMs?: number | undefined;
}): boolean {
  if (!input.requestId) return false;
  const parts = parseSignatureParts(input.signatureHeader);
  const timestamp = parts.get("ts")?.[0];
  const signatures = parts.get("v1") ?? [];
  if (!timestamp || signatures.length === 0 || !/^\d+$/u.test(timestamp)) return false;
  const timestampMs = Number(timestamp);
  const normalizedMs = timestampMs < 10_000_000_000 ? timestampMs * 1_000 : timestampMs;
  if (Math.abs((input.nowMs ?? Date.now()) - normalizedMs) > defaultToleranceSeconds * 1_000) return false;
  const manifest = `id:${input.dataId.toLowerCase()};request-id:${input.requestId};ts:${timestamp};`;
  const expected = createHmac("sha256", input.secret).update(manifest).digest("hex");
  return signatures.some((signature) => safeHexEqual(expected, signature));
}

function parseSignatureParts(value: string | undefined): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const part of value?.split(",") ?? []) {
    const [key, item] = part.trim().split("=", 2);
    if (!key || !item) continue;
    result.set(key, [...(result.get(key) ?? []), item]);
  }
  return result;
}

function safeHexEqual(expected: string, received: string): boolean {
  if (!/^[a-f0-9]{64}$/iu.test(received)) return false;
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(received, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}
