import { describe, expect, it } from "vitest";
import { canInviteRole, canUpdateMembership } from "../src/modules/team/team-policy.js";

describe("team authorization policy", () => {
  it("allows only owners to invite another administrator", () => {
    expect(canInviteRole("OWNER", "ADMIN")).toBe(true);
    expect(canInviteRole("ADMIN", "ADMIN")).toBe(false);
  });

  it("allows administrators to manage agents without elevating privileges", () => {
    expect(canInviteRole("ADMIN", "AGENT")).toBe(true);
    expect(
      canUpdateMembership({
        actorRole: "ADMIN",
        actorUserId: "admin",
        targetUserId: "agent",
        targetRole: "AGENT",
        nextRole: "AGENT",
      }),
    ).toBe(true);
    expect(
      canUpdateMembership({
        actorRole: "ADMIN",
        actorUserId: "admin",
        targetUserId: "agent",
        targetRole: "AGENT",
        nextRole: "OWNER",
      }),
    ).toBe(false);
  });

  it("prevents an administrator from modifying itself or an owner", () => {
    expect(
      canUpdateMembership({
        actorRole: "ADMIN",
        actorUserId: "admin",
        targetUserId: "admin",
        targetRole: "ADMIN",
      }),
    ).toBe(false);
    expect(
      canUpdateMembership({
        actorRole: "ADMIN",
        actorUserId: "admin",
        targetUserId: "owner",
        targetRole: "OWNER",
      }),
    ).toBe(false);
  });
});
