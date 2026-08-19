import type { Request, Response } from "express";
import { mediaIdSchema, registerMediaSchema } from "./media.schemas.js";
import { MediaService } from "./media.service.js";

const service = new MediaService();

export class MediaController {
  capabilities(_request: Request, response: Response): void {
    response.json({ data: service.capabilities() });
  }

  signature(request: Request, response: Response): void {
    response.json({ data: service.signature(request.tenant!) });
  }

  async list(request: Request, response: Response): Promise<void> {
    response.json({ data: await service.list(request.tenant!) });
  }

  async register(request: Request, response: Response): Promise<void> {
    response.status(201).json({ data: await service.register(request.tenant!, registerMediaSchema.parse(request.body)) });
  }

  async remove(request: Request, response: Response): Promise<void> {
    await service.remove(request.tenant!, mediaIdSchema.parse(request.params.id));
    response.status(204).send();
  }
}
