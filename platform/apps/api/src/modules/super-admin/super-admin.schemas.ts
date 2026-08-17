import { z } from "zod";

export const tenantListSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "CANCELED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const tenantStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "CANCELED"]),
  reason: z.string().trim().min(5).max(240),
});

export const idSchema = z.uuid();
