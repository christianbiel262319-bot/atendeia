import type { Request, Response } from "express";
import { aiConfigurationSchema } from "./ai.schemas.js";
import { AiService } from "./ai.service.js";

const service = new AiService();

export class AiController {
  async getConfiguration(request: Request, response: Response): Promise<void> {
    response.json({ data: await service.getConfiguration(request.tenant!) });
  }

  async updateConfiguration(request: Request, response: Response): Promise<void> {
    const input = aiConfigurationSchema.parse(request.body);
    response.json({ data: await service.updateConfiguration(request.tenant!, input) });
  }
}
