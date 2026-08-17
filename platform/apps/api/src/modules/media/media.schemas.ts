import { z } from "zod";

export const registerMediaSchema = z.object({
  publicId: z.string().trim().min(1).max(240),
  secureUrl: z.url().max(2_000),
  resourceType: z.enum(["image", "video", "raw"]).default("image"),
  format: z.string().trim().max(30).optional(),
  bytes: z.number().int().nonnegative().max(50 * 1024 * 1024).optional(),
  width: z.number().int().positive().max(20_000).optional(),
  height: z.number().int().positive().max(20_000).optional(),
  version: z.number().int().positive(),
  signature: z.string().regex(/^[a-f0-9]{40}$/iu),
});

export const mediaIdSchema = z.uuid();
