import type { Request, Response } from "express";
import {
  assignmentSchema,
  conversationIdSchema,
  conversationListSchema,
  humanMessageSchema,
} from "./conversation.schemas.js";
import { ConversationService } from "./conversation.service.js";

const service = new ConversationService();

export class ConversationController {
  async list(request: Request, response: Response): Promise<void> {
    response.json({ data: await service.list(request.tenant!, conversationListSchema.parse(request.query)) });
  }

  async get(request: Request, response: Response): Promise<void> {
    response.json({ data: await service.get(request.tenant!, conversationIdSchema.parse(request.params.id)) });
  }

  async assign(request: Request, response: Response): Promise<void> {
    const id = conversationIdSchema.parse(request.params.id);
    const { membershipId } = assignmentSchema.parse(request.body);
    response.json({ data: await service.assign(request.tenant!, id, membershipId) });
  }

  async send(request: Request, response: Response): Promise<void> {
    const id = conversationIdSchema.parse(request.params.id);
    const { body } = humanMessageSchema.parse(request.body);
    response.status(201).json({ data: await service.sendHumanMessage(request.tenant!, id, body) });
  }

  async resolve(request: Request, response: Response): Promise<void> {
    await service.resolve(request.tenant!, conversationIdSchema.parse(request.params.id));
    response.status(204).send();
  }
}
