import type { Request, Response } from "express";
import {
  acceptInviteSchema,
  inviteSchema,
  membershipIdSchema,
  membershipUpdateSchema,
} from "./team.schemas.js";
import { TeamService } from "./team.service.js";

const service = new TeamService();

export class TeamController {
  async list(request: Request, response: Response): Promise<void> {
    response.json({ data: await service.list(request.tenant!) });
  }

  async invite(request: Request, response: Response): Promise<void> {
    response.status(201).json({ data: await service.invite(request.tenant!, inviteSchema.parse(request.body)) });
  }

  async accept(request: Request, response: Response): Promise<void> {
    const { token } = acceptInviteSchema.parse(request.body);
    response.json({ data: await service.accept(request.tenant!, token) });
  }

  async updateMember(request: Request, response: Response): Promise<void> {
    const membershipId = membershipIdSchema.parse(request.params.id);
    const input = membershipUpdateSchema.parse(request.body);
    response.json({ data: await service.updateMember(request.tenant!, membershipId, input) });
  }
}
