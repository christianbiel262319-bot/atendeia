import type { Request, Response } from "express";
import { providerParamSchema } from "./billing.schemas.js";
import { BillingWebhookService } from "./billing-webhook.service.js";

const service = new BillingWebhookService();

export class BillingWebhookController {
  async receive(request: Request, response: Response): Promise<void> {
    const provider = providerParamSchema.parse(request.params.provider);
    const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.from("");
    const dataId = typeof request.query["data.id"] === "string" ? request.query["data.id"] : undefined;
    const result = await service.receive({
      provider,
      rawBody,
      signature: request.get("stripe-signature") ?? request.get("x-signature") ?? undefined,
      requestId: request.get("x-request-id") ?? undefined,
      dataId,
      asaasToken: request.get("asaas-access-token") ?? undefined,
    });
    response.status(result.duplicate ? 200 : 202).json({ received: true, duplicate: result.duplicate });
  }
}
