import { describe, expect, it } from "vitest";
import { shouldRunAiForConversation } from "../src/modules/conversations/conversation-policy.js";

describe("conversation automation policy", () => {
  it("runs the AI only for an open and unassigned conversation", () => {
    expect(
      shouldRunAiForConversation({ status: "OPEN", assignedMembershipId: null }),
    ).toBe(true);
  });

  it.each(["WAITING_HUMAN", "WITH_HUMAN", "RESOLVED", "ARCHIVED"] as const)(
    "does not run the AI while the conversation is %s",
    (status) => {
      expect(shouldRunAiForConversation({ status, assignedMembershipId: null })).toBe(false);
    },
  );

  it("does not run the AI when a human is assigned even if status is inconsistent", () => {
    expect(
      shouldRunAiForConversation({
        status: "OPEN",
        assignedMembershipId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toBe(false);
  });
});
