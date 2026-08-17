import type { MembershipRole } from "../../generated/prisma/enums.js";
import { forbidden } from "../errors/app-error.js";

export type TenantContext = {
  tenantId: string;
  userId: string;
  role: MembershipRole;
};

export function assertTenantMatch(tokenTenantId: string, requestedTenantId?: string): string {
  if (requestedTenantId && requestedTenantId !== tokenTenantId) {
    throw forbidden("O tenant informado não corresponde à sessão ativa");
  }
  return tokenTenantId;
}
