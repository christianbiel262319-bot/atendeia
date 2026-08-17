import type { PaymentProvider } from "../../../generated/prisma/enums.js";

export type CheckoutCustomer = {
  name: string;
  email: string;
  taxId?: string | undefined;
};

export type CheckoutPlan = {
  id: string;
  name: string;
  monthlyPrice: number;
  currency: string;
};

export type CheckoutRequest = {
  tenantId: string;
  idempotencyKey: string;
  plan: CheckoutPlan;
  customer: CheckoutCustomer;
};

export type CheckoutResult = {
  provider: PaymentProvider;
  externalId: string;
  redirectUrl: string;
};

export interface BillingProviderAdapter {
  createCheckout(input: CheckoutRequest): Promise<CheckoutResult>;
  cancel(externalId: string): Promise<void>;
}
