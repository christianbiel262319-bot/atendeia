import { z } from "zod";

const password = z
  .string()
  .min(12, "A senha deve ter pelo menos 12 caracteres")
  .max(128)
  .regex(/[a-z]/, "Inclua uma letra minúscula")
  .regex(/[A-Z]/, "Inclua uma letra maiúscula")
  .regex(/\d/, "Inclua um número")
  .regex(/[^A-Za-z0-9]/, "Inclua um caractere especial");

export const registerSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  fullName: z.string().trim().min(2).max(160),
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  password,
});

export const loginSchema = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
  tenantId: z.uuid().optional(),
});

export const mfaLoginSchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
});

export const mfaConfirmSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
