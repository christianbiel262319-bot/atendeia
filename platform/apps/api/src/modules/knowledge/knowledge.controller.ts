import type { Request, Response } from "express";
import {
  businessHourSchema,
  faqSchema,
  faqPatchSchema,
  idSchema,
  productSchema,
  productPatchSchema,
  serviceSchema,
  servicePatchSchema,
} from "./knowledge.schemas.js";
import { KnowledgeService } from "./knowledge.service.js";

const service = new KnowledgeService();

export class KnowledgeController {
  async list(request: Request, response: Response): Promise<void> {
    response.json({ data: await service.list(request.tenant!) });
  }

  async createProduct(request: Request, response: Response): Promise<void> {
    response.status(201).json({ data: await service.createProduct(request.tenant!, productSchema.parse(request.body)) });
  }

  async createService(request: Request, response: Response): Promise<void> {
    response.status(201).json({ data: await service.createService(request.tenant!, serviceSchema.parse(request.body)) });
  }

  async createFaq(request: Request, response: Response): Promise<void> {
    response.status(201).json({ data: await service.createFaq(request.tenant!, faqSchema.parse(request.body)) });
  }

  async upsertHour(request: Request, response: Response): Promise<void> {
    response.json({ data: await service.upsertBusinessHour(request.tenant!, businessHourSchema.parse(request.body)) });
  }

  async updateProduct(request: Request, response: Response): Promise<void> {
    const id = idSchema.parse(request.params.id);
    response.json({ data: await service.updateProduct(request.tenant!, id, productPatchSchema.parse(request.body)) });
  }

  async updateService(request: Request, response: Response): Promise<void> {
    const id = idSchema.parse(request.params.id);
    response.json({ data: await service.updateService(request.tenant!, id, servicePatchSchema.parse(request.body)) });
  }

  async updateFaq(request: Request, response: Response): Promise<void> {
    const id = idSchema.parse(request.params.id);
    response.json({ data: await service.updateFaq(request.tenant!, id, faqPatchSchema.parse(request.body)) });
  }

  async remove(request: Request, response: Response): Promise<void> {
    const id = idSchema.parse(request.params.id);
    const resource = request.params.resource;
    if (resource !== "product" && resource !== "service" && resource !== "faq") {
      response.status(404).json({ error: { code: "NOT_FOUND", message: "Recurso inválido" } });
      return;
    }
    await service.remove(request.tenant!, resource, id);
    response.status(204).send();
  }
}
