import { z } from "zod";

export const checkoutSchema = z.object({
  planId: z.uuid(),
  provider: z.enum(["STRIPE", "MERCADO_PAGO", "ASAAS"]),
  taxId: z
    .string()
    .transform((value) => value.replace(/\D/gu, ""))
    .pipe(z.string().min(11).max(14))
    .optional(),
});

export const providerParamSchema = z.enum(["stripe", "mercado-pago", "asaas"]);

export const planCreateSchema = z.object({
  code: z.string().trim().min(2).max(50).regex(/^[a-z0-9-]+$/u),
  name: z.string().trim().min(2).max(100),
  monthlyPrice: z.coerce.number().min(0).max(1_000_000),
  currency: z.string().trim().toUpperCase().length(3).default("BRL"),
  limits: z.record(z.string(), z.union([z.number().nonnegative(), z.boolean(), z.string().max(120)])),
  active: z.boolean().default(true),
});

export const planUpdateSchema = planCreateSchema.omit({ code: true }).partial();
export const planIdSchema = z.uuid();
