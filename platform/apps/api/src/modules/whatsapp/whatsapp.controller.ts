import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { forbidden } from "../../core/errors/app-error.js";
import { connectWhatsAppSchema } from "./whatsapp.schemas.js";
import { WhatsAppService } from "./whatsapp.service.js";
import { verifyMetaSignature } from "./webhook-security.js";

const service = new WhatsAppService();

export class WhatsAppController {
  async getConnection(request: Request, response: Response): Promise<void> {
    response.json({ data: await service.getConnection(request.tenant!) });
  }

  async connect(request: Request, response: Response): Promise<void> {
    const input = connectWhatsAppSchema.parse(request.body);
    response.status(201).json({ data: await service.connect(request.tenant!, input) });
  }

  verifyWebhook(request: Request, response: Response): void {
    const mode = request.query["hub.mode"];
    const token = request.query["hub.verify_token"];
    const challenge = request.query["hub.challenge"];
    if (
      mode === "subscribe" &&
      typeof token === "string" &&
      token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN &&
      typeof challenge === "string"
    ) {
      response.status(200).type("text/plain").send(challenge);
      return;
    }
    throw forbidden("Verificação de webhook inválida");
  }

  async receiveWebhook(request: Request, response: Response): Promise<void> {
    const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    if (!verifyMetaSignature(rawBody, request.get("x-hub-signature-256"))) {
      throw forbidden("Assinatura de webhook inválida");
    }
    const result = await service.acceptWebhook(rawBody);
    response.status(200).json({ received: true, ...result });
  }
}
