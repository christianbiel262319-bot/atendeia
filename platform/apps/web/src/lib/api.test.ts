import { describe, expect, it } from "vitest";
import { decodeAccessToken } from "./api";

describe("access token parsing", () => {
  it("reads the tenant context from a JWT payload", () => {
    const payload = btoa(JSON.stringify({ sub: "user-1", tenantId: "tenant-1", role: "OWNER" }));
    expect(decodeAccessToken(`header.${payload}.signature`)).toEqual({
      sub: "user-1",
      tenantId: "tenant-1",
      role: "OWNER",
    });
  });
});
