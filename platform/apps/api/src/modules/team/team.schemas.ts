import { z } from "zod";

export const inviteSchema = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  role: z.enum(["ADMIN", "AGENT"]),
});

export const acceptInviteSchema = z.object({ token: z.string().min(32).max(256) });
export const membershipUpdateSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "AGENT"]).optional(),
  active: z.boolean().optional(),
});
export const membershipIdSchema = z.uuid();
