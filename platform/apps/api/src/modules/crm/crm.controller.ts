import type { Request, Response } from "express";
import {
  contactCreateSchema,
  contactIdSchema,
  contactListSchema,
  contactNoteSchema,
  contactUpdateSchema,
} from "./crm.schemas.js";
import { CrmService } from "./crm.service.js";

const service = new CrmService();

export class CrmController {
  async list(request: Request, response: Response): Promise<void> {
    response.json({ data: await service.list(request.tenant!, contactListSchema.parse(request.query)) });
  }

  async get(request: Request, response: Response): Promise<void> {
    response.json({ data: await service.get(request.tenant!, contactIdSchema.parse(request.params.id)) });
  }

  async create(request: Request, response: Response): Promise<void> {
    response.status(201).json({ data: await service.create(request.tenant!, contactCreateSchema.parse(request.body)) });
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

  async addNote(request: Request, response: Response): Promise<void> {
    const input = contactNoteSchema.parse(request.body);
    response.status(201).json({
      data: await service.addNote(request.tenant!, contactIdSchema.parse(request.params.id), input.body),
    });
  }

  async removeNote(request: Request, response: Response): Promise<void> {
    await service.removeNote(
      request.tenant!,
      contactIdSchema.parse(request.params.id),
      contactIdSchema.parse(request.params.noteId),
    );
    response.status(204).send();
  }

  async archive(request: Request, response: Response): Promise<void> {
    response.json({ data: await service.archive(request.tenant!, contactIdSchema.parse(request.params.id)) });
  }

  async restore(request: Request, response: Response): Promise<void> {
    response.json({ data: await service.restore(request.tenant!, contactIdSchema.parse(request.params.id)) });
  }
}
