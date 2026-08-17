import type { Request, Response } from "express";
import { contactIdSchema, contactListSchema, contactUpdateSchema } from "./crm.schemas.js";
import { CrmService } from "./crm.service.js";

const service = new CrmService();

export class CrmController {
  async list(request: Request, response: Response): Promise<void> {
    response.json({ data: await service.list(request.tenant!, contactListSchema.parse(request.query)) });
  }

  async update(request: Request, response: Response): Promise<void> {
    response.json({
      data: await service.update(
        request.tenant!,
        contactIdSchema.parse(request.params.id),
        contactUpdateSchema.parse(request.body),
      ),
    });
  }
}
