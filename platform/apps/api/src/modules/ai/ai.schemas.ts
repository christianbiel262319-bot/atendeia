import { z } from "zod";

export const aiConfigurationSchema = z.object({
  enabled: z.boolean(),
  tone: z.string().trim().min(3).max(120),
  minimumConfidence: z.coerce.number().min(0.5).max(1),
  fallbackMessage: z.string().trim().min(3).max(1000).nullable(),
  transferMessage: z.string().trim().min(3).max(1000).nullable(),
  maxContextMessages: z.coerce.number().int().min(1).max(50),
});
