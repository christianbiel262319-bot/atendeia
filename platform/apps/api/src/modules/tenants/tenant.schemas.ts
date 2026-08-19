import { z } from "zod";

export const tenantProfileUpdateSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa").max(160),
  timezone: z.string().trim().min(1).max(80).refine(isValidTimeZone, "Fuso horário inválido"),
});

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
