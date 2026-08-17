import type { Request, Response } from "express";
import { planCreateSchema, planIdSchema, planUpdateSchema } from "../billing/billing.schemas.js";
import { idSchema, tenantListSchema, tenantStatusSchema } from "./super-admin.schemas.js";
import { SuperAdminService } from "./super-admin.service.js";

const service = new SuperAdminService();

export class SuperAdminController {
  async overview(_request: Request, response: Response): Promise<void> {
    response.json({ data: await service.overview() });
  }

  async tenants(request: Request, response: Response): Promise<void> {
    response.json({ data: await service.listTenants(tenantListSchema.parse(request.query)) });
  }

  async updateTenantStatus(request: Request, response: Response): Promise<void> {
    const tenantId = idSchema.parse(request.params.id);
    response.json({ data: await service.updateTenantStatus(request.tenant!, tenantId, tenantStatusSchema.parse(request.body)) });
  }

  async plans(_request: Request, response: Response): Promise<void> {
    response.json({ data: await service.listPlans() });
  }

  async createPlan(request: Request, response: Response): Promise<void> {
    response.status(201).json({ data: await service.createPlan(request.tenant!, planCreateSchema.parse(request.body)) });
  }

  async updatePlan(request: Request, response: Response): Promise<void> {
    response.json({
      data: await service.updatePlan(
        request.tenant!,
        planIdSchema.parse(request.params.id),
        planUpdateSchema.parse(request.body),
      ),
    });
  }
}
