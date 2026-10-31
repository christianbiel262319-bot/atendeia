import { createHash } from "node:crypto";

export function cloudinarySignature(
  parameters: Record<string, string | number>,
  secret: string,
): string {
  const serialized = Object.entries(parameters)
    .filter(([, value]) => value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash("sha1").update(`${serialized}${secret}`, "utf8").digest("hex");
}

