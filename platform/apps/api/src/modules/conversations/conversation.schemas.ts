import { z } from "zod";

export const conversationListSchema = z.object({
  status: z.enum(["OPEN", "WAITING_HUMAN", "WITH_HUMAN", "RESOLVED", "ARCHIVED"]).optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const assignmentSchema = z.object({
  membershipId: z.uuid().nullable(),
});

export const humanMessageSchema = z.object({
  body: z.string().trim().min(1).max(3000),
});

export const conversationIdSchema = z.uuid();
