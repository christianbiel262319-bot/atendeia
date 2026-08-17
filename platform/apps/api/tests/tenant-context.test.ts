import { describe, expect, it } from "vitest";
import { AppError } from "../src/core/errors/app-error.js";
import { assertTenantMatch } from "../src/core/tenant/tenant-context.js";

describe("tenant isolation", () => {
  it("returns the tenant from the signed token", () => {
    expect(assertTenantMatch("tenant-a")).toBe("tenant-a");
    expect(assertTenantMatch("tenant-a", "tenant-a")).toBe("tenant-a");
  });

  it("rejects a tenant header that differs from the token", () => {
    expect(() => assertTenantMatch("tenant-a", "tenant-b")).toThrow(AppError);
  });
});
