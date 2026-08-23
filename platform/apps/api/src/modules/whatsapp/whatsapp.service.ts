import type { Prisma } from "../../generated/prisma/client.js";
import { env } from "../../config/env.js";
import { AppError, forbidden } from "../../core/errors/app-error.js";
import { encryptSecret, sha256 } from "../../core/security/crypto.js";
import type { TenantContext } from "../../core/tenant/tenant-context.js";
import { prisma } from "../../infra/database/prisma.js";
import { getWebhookQueue } from "../../infra/queues/queues.js";
import { MetaWhatsAppClient } from "./meta.client.js";
import { metaWebhookSchema } from "./whatsapp.schemas.js";

const metaClient = new MetaWhatsAppClient();

export class WhatsAppService {
  async connect(
    context: TenantContext,
    input: { phoneNumberId: string; businessAccountId: string; accessToken: string },
  ) {
    if (!env.META_APP_SECRET || !env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      throw new AppError(
        503,
        "PROVIDER_NOT_CONFIGURED",
        "Configuração necessária: finalize as credenciais do aplicativo e do webhook da Meta no servidor",
      );
    }
    const existing = await prisma.whatsAppConnection.findUnique({
      where: { phoneNumberId: input.phoneNumberId },
      select: { tenantId: true },
    });
    if (existing && existing.tenantId !== context.tenantId) {
      throw forbidden("Este número já está vinculado a outra empresa");
    }

    const inspected = await metaClient.inspectPhoneNumber(input.phoneNumberId, input.accessToken);
    return prisma.$transaction(async (tx) => {
      const secret = await tx.tenantSecret.upsert({
        where: { tenantId_type: { tenantId: context.tenantId, type: "WHATSAPP_ACCESS_TOKEN" } },
        create: {
          tenantId: context.tenantId,
          type: "WHATSAPP_ACCESS_TOKEN",
          ciphertext: encryptSecret(input.accessToken),
          lastFour: input.accessToken.slice(-4),
        },
        update: {
          ciphertext: encryptSecret(input.accessToken),
          lastFour: input.accessToken.slice(-4),
        },
      });
      const connection = await tx.whatsAppConnection.upsert({
        where: { phoneNumberId: input.phoneNumberId },
        create: {
          tenantId: context.tenantId,
          phoneNumberId: input.phoneNumberId,
          businessAccountId: input.businessAccountId,
          displayPhoneNumber: inspected.display_phone_number ?? null,
          accessTokenSecretId: secret.id,
          status: "CONNECTED",
          connectedAt: new Date(),
        },
        update: {
          businessAccountId: input.businessAccountId,
          displayPhoneNumber: inspected.display_phone_number ?? null,
          accessTokenSecretId: secret.id,
          status: "CONNECTED",
          connectedAt: new Date(),
        },
        select: {
          id: true,
          phoneNumberId: true,
          displayPhoneNumber: true,
          status: true,
          connectedAt: true,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          actorUserId: context.userId,
          action: "whatsapp.connected",
          resourceType: "whatsapp_connection",
          resourceId: connection.id,
        },
      });
      return connection;
    });
  }

  async getConnection(context: TenantContext) {
    return prisma.whatsAppConnection.findFirst({
      where: { tenantId: context.tenantId },
      select: {
        id: true,
        phoneNumberId: true,
        businessAccountId: true,
        displayPhoneNumber: true,
        status: true,
        connectedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async acceptWebhook(rawBody: Buffer): Promise<{ accepted: number; ignored: number }> {
    const payload = metaWebhookSchema.parse(JSON.parse(rawBody.toString("utf8")));
    let accepted = 0;
    let ignored = 0;

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const connection = await prisma.whatsAppConnection.findUnique({
          where: { phoneNumberId: change.value.metadata.phone_number_id },
          select: { tenantId: true, status: true },
        });
        if (!connection || connection.status !== "CONNECTED") {
          ignored += 1;
          continue;
        }

        const events = [
          ...(change.value.messages ?? []).map((message) => ({
            externalEventId: `message:${message.id}`,
            eventType: "message",
          })),
          ...(change.value.statuses ?? []).map((status) => ({
            externalEventId: `status:${status.id}:${status.status}:${status.timestamp ?? "unknown"}`,
            eventType: `status.${status.status}`,
          })),
        ];

        for (const event of events) {
          const createResult = await prisma.webhookEvent.createMany({
            data: [{
              tenantId: connection.tenantId,
              externalEventId: event.externalEventId,
              eventType: event.eventType,
              payloadHash: sha256(rawBody.toString("utf8")),
              payload: change.value as Prisma.InputJsonValue,
            }],
            skipDuplicates: true,
          });
          const stored = await prisma.webhookEvent.findUniqueOrThrow({
            where: {
              tenantId_externalEventId: {
                tenantId: connection.tenantId,
                externalEventId: event.externalEventId,
              },
            },
            select: { id: true, status: true },
          });
          if (createResult.count === 0 && ["PROCESSING", "PROCESSED", "IGNORED"].includes(stored.status)) {
            ignored += 1;
            continue;
          }
          await getWebhookQueue().add(
            event.eventType,
            { tenantId: connection.tenantId, webhookEventId: stored.id },
            { jobId: stored.id },
          );
          accepted += 1;
        }
      }
    }
    return { accepted, ignored };
  }
}
