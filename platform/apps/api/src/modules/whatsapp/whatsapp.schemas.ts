import { z } from "zod";

export const connectWhatsAppSchema = z.object({
  phoneNumberId: z.string().trim().min(5).max(80),
  businessAccountId: z.string().trim().min(5).max(80),
  accessToken: z.string().trim().min(20).max(2048),
});

const webhookValueSchema = z.object({
  metadata: z.object({ phone_number_id: z.string().min(1) }),
  messages: z.array(z.object({ id: z.string().min(1) }).passthrough()).optional(),
  statuses: z
    .array(
      z
        .object({
          id: z.string().min(1),
          status: z.string().min(1),
          timestamp: z.string().optional(),
        })
        .passthrough(),
    )
    .optional(),
}).passthrough();

export const metaWebhookSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          field: z.string(),
          value: webhookValueSchema,
        }),
      ),
    }),
  ),
});
