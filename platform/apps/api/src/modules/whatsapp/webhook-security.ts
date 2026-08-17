import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";

export function verifyMetaSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret = env.META_APP_SECRET,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const received = signatureHeader.slice("sha256=".length);
  if (!/^[a-f0-9]{64}$/iu.test(received)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const receivedBuffer = Buffer.from(received, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}
