import { describe, expect, it } from "vitest";
import { cloudinarySignature } from "../src/modules/media/media.service.js";

describe("Cloudinary signed upload", () => {
  it("sorts parameters and binds them to the secret", () => {
    const first = cloudinarySignature({ timestamp: 1_800_000_000, folder: "atendeia/tenant-a" }, "secret-value");
    const reordered = cloudinarySignature({ folder: "atendeia/tenant-a", timestamp: 1_800_000_000 }, "secret-value");
    const changedTenant = cloudinarySignature({ folder: "atendeia/tenant-b", timestamp: 1_800_000_000 }, "secret-value");
    expect(first).toMatch(/^[a-f0-9]{40}$/u);
    expect(first).toBe(reordered);
    expect(first).not.toBe(changedTenant);
  });
});
