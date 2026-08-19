import { z } from "zod";

const statusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
const priceSchema = z.coerce.number().nonnegative().max(99_999_999).nullable();
const categorySchema = z.string().trim().min(1).max(80).nullable();
const imageAssetSchema = z.uuid().nullable();

export const knowledgeListSchema = z.object({
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  status: statusSchema.optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const productFields = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(5_000),
  category: categorySchema,
  price: priceSchema,
  currency: z.string().length(3),
  available: z.boolean(),
  imageAssetId: imageAssetSchema,
  status: statusSchema,
});
export const productSchema = productFields.extend({
  category: categorySchema.default(null),
  price: priceSchema.default(null),
  currency: z.string().length(3).default("BRL"),
  available: z.boolean().default(true),
  imageAssetId: imageAssetSchema.default(null),
  status: statusSchema.default("DRAFT"),
});
export const productPatchSchema = requireChange(productFields.partial());

const serviceFields = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(5_000),
  category: categorySchema,
  durationMinutes: z.coerce.number().int().positive().max(100_000).nullable(),
  price: priceSchema,
  currency: z.string().length(3),
  available: z.boolean(),
  status: statusSchema,
});
export const serviceSchema = serviceFields.extend({
  category: categorySchema.default(null),
  durationMinutes: serviceFields.shape.durationMinutes.default(null),
  price: priceSchema.default(null),
  currency: z.string().length(3).default("BRL"),
  available: z.boolean().default(true),
  status: statusSchema.default("DRAFT"),
});
export const servicePatchSchema = requireChange(serviceFields.partial());

const faqFields = z.object({
  question: z.string().trim().min(3).max(1_000),
  answer: z.string().trim().min(2).max(5_000),
  category: categorySchema,
  status: statusSchema,
  sortOrder: z.coerce.number().int().min(0).max(100_000),
});
export const faqSchema = faqFields.extend({
  category: categorySchema.default(null),
  status: statusSchema.default("DRAFT"),
  sortOrder: z.coerce.number().int().min(0).max(100_000).default(0),
});
export const faqPatchSchema = requireChange(faqFields.partial());

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u).nullable();

export const businessHourSchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    opensAt: timeSchema,
    closesAt: timeSchema,
    isClosed: z.boolean().default(false),
  })
  .superRefine(validateHours);

export const businessHourExceptionSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Informe uma data válida"),
    label: z.string().trim().min(1).max(120).nullable().default(null),
    opensAt: timeSchema,
    closesAt: timeSchema,
    isClosed: z.boolean().default(true),
  })
  .superRefine(validateHours);

const usefulLinkSchema = z.object({
  label: z.string().trim().min(1).max(80),
  url: z.url().max(2_000).refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  }, "Use um endereço HTTP ou HTTPS"),
});

export const companyProfileSchema = z.object({
  description: z.string().trim().min(1).max(10_000).nullable().default(null),
  address: z.string().trim().min(1).max(1_000).nullable().default(null),
  phoneE164: z.string().trim().regex(/^\+[1-9]\d{7,14}$/u, "Use o formato internacional, por exemplo +5511999999999").nullable().default(null),
  email: z.email().max(254).nullable().default(null),
  policies: z.string().trim().min(1).max(10_000).nullable().default(null),
  usefulLinks: z.array(usefulLinkSchema).max(20).default([]),
});

export const idSchema = z.uuid();

function validateHours(
  value: { isClosed: boolean; opensAt: string | null; closesAt: string | null },
  context: z.RefinementCtx,
): void {
  if (!value.isClosed && (!value.opensAt || !value.closesAt)) {
    context.addIssue({ code: "custom", message: "Informe abertura e fechamento" });
  }
  if (!value.isClosed && value.opensAt === value.closesAt) {
    context.addIssue({ code: "custom", message: "Abertura e fechamento devem ser diferentes" });
  }
}

function requireChange<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Informe ao menos uma alteração",
  });
}
