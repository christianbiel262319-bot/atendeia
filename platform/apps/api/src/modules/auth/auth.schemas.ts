import { z } from "zod";

export const strongPasswordSchema = z
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
  password: strongPasswordSchema,
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

export const forgotPasswordSchema = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(512),
  password: strongPasswordSchema,
});

export const verificationTokenSchema = z.object({
  token: z.string().min(32).max(512),
});

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: strongPasswordSchema,
  })
  .refine((input) => input.currentPassword !== input.newPassword, {
    path: ["newPassword"],
    message: "A nova senha deve ser diferente da senha atual",
  });

export const disableMfaSchema = z.object({
  password: z.string().min(1).max(128),
  code: z.string().regex(/^\d{6}$/),
});

export const sessionIdSchema = z.uuid();

export const invitationTokenSchema = z.object({ token: z.string().min(32).max(256) });

export const invitationRegisterSchema = z.object({
  token: z.string().min(32).max(256),
  fullName: z.string().trim().min(2).max(160),
  password: strongPasswordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type InvitationRegisterInput = z.infer<typeof invitationRegisterSchema>;
