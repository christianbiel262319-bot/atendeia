import { z } from "zod";

const phoneE164Schema = z
  .string()
  .trim()
  .max(32)
  .superRefine((value, context) => {
    const normalized = `+${value.replace(/\D/gu, "")}`;
    if (!value.startsWith("+") || !/^\+[1-9]\d{7,14}$/u.test(normalized)) {
      context.addIssue({ code: "custom", message: "Informe o telefone com código do país, por exemplo +5511999999999" });
    }
  })
  .transform((value) => `+${value.replace(/\D/gu, "")}`);

const nullableEmailSchema = z.union([z.email().max(254), z.null()]);
const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(20);

export const contactListSchema = z.object({
  search: z.string().trim().max(120).optional(),
  tag: z.string().trim().min(1).max(40).optional(),
  source: z.enum(["WHATSAPP", "MANUAL", "IMPORT", "API"]).optional(),
  archived: z.stringbool().default(false),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

export const contactCreateSchema = z.object({
  displayName: z.string().trim().min(1).max(160),
  phoneE164: phoneE164Schema,
  email: nullableEmailSchema.optional(),
  tags: tagsSchema.default([]),
});

export const contactUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(160).nullable().optional(),
    phoneE164: phoneE164Schema.optional(),
    email: nullableEmailSchema.optional(),
    tags: tagsSchema.optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Informe ao menos uma alteração",
  });

export const contactNoteSchema = z.object({
  body: z.string().trim().min(1).max(5_000),
});

export const contactIdSchema = z.uuid();

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = tag.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
