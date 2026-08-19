export type AutomationConversationState = {
  status: "OPEN" | "WAITING_HUMAN" | "WITH_HUMAN" | "RESOLVED" | "ARCHIVED";
  assignedMembershipId: string | null;
};

export function shouldRunAiForConversation(
  conversation: AutomationConversationState,
): boolean {
  return conversation.status === "OPEN" && conversation.assignedMembershipId === null;
}
