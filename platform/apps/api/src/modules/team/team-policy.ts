import type { MembershipRole } from "../../generated/prisma/enums.js";

export type AssignableTeamRole = "OWNER" | "ADMIN" | "AGENT";
export type InvitableTeamRole = Exclude<AssignableTeamRole, "OWNER">;

export function canInviteRole(
  actorRole: MembershipRole,
  invitedRole: InvitableTeamRole,
): boolean {
  if (actorRole === "OWNER") return true;
  return actorRole === "ADMIN" && invitedRole === "AGENT";
}

export function canUpdateMembership(input: {
  actorRole: MembershipRole;
  actorUserId: string;
  targetUserId: string;
  targetRole: MembershipRole;
  nextRole?: AssignableTeamRole | undefined;
}): boolean {
  if (input.actorRole === "OWNER") return true;
  if (input.actorRole !== "ADMIN") return false;
  if (input.actorUserId === input.targetUserId) return false;
  if (input.targetRole !== "AGENT") return false;
  return input.nextRole === undefined || input.nextRole === "AGENT";
}
