import { decryptSecret } from "../../core/security/crypto.js";
import type { MessageSender } from "../../generated/prisma/enums.js";
import { prisma } from "../../infra/database/prisma.js";
import { MetaWhatsAppClient } from "./meta.client.js";

const metaClient = new MetaWhatsAppClient();

export class WhatsAppOutboundService {
  async send(input: {
    tenantId: string;
    conversationId: string;
    phoneNumberId: string;
    to: string;
    body: string;
    sender: MessageSender;
    ai?: {
      confidence: number;
      canAnswer: boolean;
      needsHuman: boolean;
      reason: string;
    };
  }) {
    const connection = await prisma.whatsAppConnection.findFirst({
      where: { tenantId: input.tenantId, phoneNumberId: input.phoneNumberId, status: "CONNECTED" },
      select: { accessTokenSecretId: true },
    });
    if (!connection?.accessTokenSecretId) throw new Error("WhatsApp connection secret missing");
    const secret = await prisma.tenantSecret.findFirst({
      where: {
        id: connection.accessTokenSecretId,
        tenantId: input.tenantId,
        type: "WHATSAPP_ACCESS_TOKEN",
      },
    });
    if (!secret) throw new Error("WhatsApp access token missing");

    const planned = await prisma.message.create({
      data: {
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        direction: "OUTBOUND",
        sender: input.sender,
        status: "QUEUED",
        body: input.body,
        ...(input.ai
          ? {
              aiConfidence: input.ai.confidence,
              aiCanAnswer: input.ai.canAnswer,
              aiNeedsHuman: input.ai.needsHuman,
              aiReason: input.ai.reason,
            }
          : {}),
      },
    });

    try {
      const sent = await metaClient.sendText({
        phoneNumberId: input.phoneNumberId,
        accessToken: decryptSecret(secret.ciphertext),
        to: input.to,
        body: input.body,
      });
      const externalMessageId = sent.messages[0]?.id;
      await prisma.message.updateMany({
        where: { id: planned.id, tenantId: input.tenantId },
        data: {
          status: externalMessageId ? "SENT" : "FAILED",
          externalMessageId: externalMessageId ?? null,
        },
      });
      return prisma.message.findFirstOrThrow({
        where: { id: planned.id, tenantId: input.tenantId },
      });
    } catch (error) {
      await prisma.message.updateMany({
        where: { id: planned.id, tenantId: input.tenantId },
        data: { status: "FAILED" },
      });
      throw error;
    }
  }
}
