import type { TenantContext } from "../core/tenant/tenant-context.js";

declare global {
  namespace Express {
    interface Request {
      id?: string;
      tenant?: TenantContext;
    }
  }
}

export {};
