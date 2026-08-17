import { z } from "zod";

export const productSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(5000),
  price: z.coerce.number().nonnegative().max(99_999_999).nullable().optional(),
  currency: z.string().length(3).default("BRL"),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
});
export const productPatchSchema = productSchema.partial();

export const serviceSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(5000),
  durationMinutes: z.coerce.number().int().positive().max(100_000).nullable().optional(),
  price: z.coerce.number().nonnegative().max(99_999_999).nullable().optional(),
  currency: z.string().length(3).default("BRL"),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
});
export const servicePatchSchema = serviceSchema.partial();

export const faqSchema = z.object({
  question: z.string().trim().min(3).max(1000),
  answer: z.string().trim().min(2).max(5000),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  sortOrder: z.coerce.number().int().min(0).max(100_000).default(0),
});
export const faqPatchSchema = faqSchema.partial();

export const businessHourSchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    opensAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
    closesAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
    isClosed: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (!value.isClosed && (!value.opensAt || !value.closesAt)) {
      context.addIssue({ code: "custom", message: "Informe abertura e fechamento" });
    }
  });

export const idSchema = z.uuid();
