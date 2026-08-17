import { z } from "zod";

export const contactListSchema = z.object({
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const contactUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(160).nullable().optional(),
  email: z.email().max(254).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

export const contactIdSchema = z.uuid();
