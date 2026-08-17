import type { Request, Response } from "express";
import { checkoutSchema } from "./billing.schemas.js";
import { BillingService } from "./billing.service.js";

const service = new BillingService();

export class BillingController {
  async plans(_request: Request, response: Response): Promise<void> {
    response.json({ data: await service.listPlans() });
  }

  async current(request: Request, response: Response): Promise<void> {
    response.json({ data: await service.current(request.tenant!) });
  }

  async checkout(request: Request, response: Response): Promise<void> {
    const result = await service.checkout(request.tenant!, checkoutSchema.parse(request.body));
    response.status(201).json({ data: result });
  }

  async cancel(request: Request, response: Response): Promise<void> {
    await service.cancel(request.tenant!);
    response.status(204).send();
  }
}
