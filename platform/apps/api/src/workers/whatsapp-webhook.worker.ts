import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { z } from "zod";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { prisma } from "../infra/database/prisma.js";
import { publishTenantEvent } from "../infra/realtime/pubsub.js";
import { AiService } from "../modules/ai/ai.service.js";
import { shouldRunAiForConversation } from "../modules/conversations/conversation-policy.js";
import { WhatsAppOutboundService } from "../modules/whatsapp/outbound.service.js";

const jobSchema = z.object({ tenantId: z.uuid(), webhookEventId: z.uuid() });
const webhookValueSchema = z
  .object({
    metadata: z.object({ phone_number_id: z.string() }),
    contacts: z
      .array(z.object({ wa_id: z.string(), profile: z.object({ name: z.string().optional() }).optional() }).passthrough())
      .optional(),
    messages: z
      .array(
        z
          .object({
            id: z.string(),
            from: z.string(),
            type: z.string(),
            text: z.object({ body: z.string() }).optional(),
          })
          .passthrough(),
      )
      .optional(),
    statuses: z.array(z.object({ id: z.string(), status: z.string() }).passthrough()).optional(),
  })
  .passthrough();

const aiService = new AiService();
const outboundService = new WhatsAppOutboundService();

export function createWhatsAppWebhookWorker() {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const realtimePublisher = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1 });
  const worker = new Worker(
    "whatsapp-webhooks",
    async (job) => processWebhookJob(job, realtimePublisher),
    { connection, concurrency: 10 },
  );
  worker.on("completed", (job) => logger.debug({ jobId: job.id }, "Webhook job completed"));
  worker.on("failed", (job, error) => logger.error({ jobId: job?.id, error }, "Webhook job failed"));
  worker.on("error", (error) => logger.error({ error }, "Webhook worker error"));
  return { worker, connection, realtimePublisher };
}

async function processWebhookJob(job: Job, realtimePublisher: Redis): Promise<void> {
  const input = jobSchema.parse(job.data);
  const event = await prisma.webhookEvent.findFirst({
    where: { id: input.webhookEventId, tenantId: input.tenantId },
  });
  if (!event || event.status === "PROCESSED" || event.status === "IGNORED") return;

  const claimed = await prisma.webhookEvent.updateMany({
    where: { id: event.id, tenantId: input.tenantId, status: { in: ["RECEIVED", "FAILED"] } },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) return;

  try {
    const payload = webhookValueSchema.parse(event.payload);
    if (event.eventType === "message") {
      await processInboundMessage(input.tenantId, event.externalEventId, payload, realtimePublisher);
    } else if (event.eventType.startsWith("status.")) {
      await processStatus(input.tenantId, event.externalEventId, payload);
    }
    await prisma.webhookEvent.updateMany({
      where: { id: event.id, tenantId: input.tenantId },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  } catch (error) {
    await prisma.webhookEvent.updateMany({
      where: { id: event.id, tenantId: input.tenantId },
      data: { status: "FAILED" },
    });
    throw error;
  }
}

async function processInboundMessage(
  tenantId: string,
  externalEventId: string,
  payload: z.infer<typeof webhookValueSchema>,
  realtimePublisher: Redis,
): Promise<void> {
  const messageId = externalEventId.replace(/^message:/u, "");
  const message = payload.messages?.find((item) => item.id === messageId);
  if (!message) return;

  const contactProfile = payload.contacts?.find((contact) => contact.wa_id === message.from);
  const contact = await prisma.contact.upsert({
    where: { tenantId_whatsappUserId: { tenantId, whatsappUserId: message.from } },
    create: {
      tenantId,
      whatsappUserId: message.from,
      phoneE164: message.from,
      displayName: contactProfile?.profile?.name ?? null,
    },
    update: {
      phoneE164: message.from,
      ...(contactProfile?.profile?.name ? { displayName: contactProfile.profile.name } : {}),
    },
  });

  let conversation = await prisma.conversation.findFirst({
    where: {
      tenantId,
      contactId: contact.id,
      status: { in: ["OPEN", "WAITING_HUMAN", "WITH_HUMAN"] },
    },
    orderBy: { updatedAt: "desc" },
  });
  conversation ??= await prisma.conversation.create({
    data: { tenantId, contactId: contact.id },
  });

  const body = message.type === "text" ? message.text?.body?.trim() : undefined;
  await prisma.message.upsert({
    where: { tenantId_externalMessageId: { tenantId, externalMessageId: message.id } },
    create: {
      tenantId,
      conversationId: conversation.id,
      externalMessageId: message.id,
      direction: "INBOUND",
      sender: "CUSTOMER",
      status: "RECEIVED",
      body: body || `[Mensagem ${message.type} recebida]`,
    },
    update: { status: "RECEIVED" },
  });

  if (!shouldRunAiForConversation(conversation)) {
    await publishTenantEvent(realtimePublisher, tenantId, {
      type: "conversation.updated",
      conversationId: conversation.id,
    });
    return;
  }

  if (!body) {
    await markWaitingForHuman(tenantId, conversation.id, "UNSUPPORTED_MESSAGE_TYPE");
    await publishTenantEvent(realtimePublisher, tenantId, {
      type: "conversation.updated",
      conversationId: conversation.id,
    });
    return;
  }

  const history = await prisma.message.findMany({
    where: { tenantId, conversationId: conversation.id },
    select: { sender: true, body: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const answer = await aiService.answer({ tenantId, question: body, history: history.reverse() });
  if (answer.needsHuman) {
    await markWaitingForHuman(tenantId, conversation.id, answer.reason);
  }

  await sendAutomatedAnswer({
    tenantId,
    conversationId: conversation.id,
    phoneNumberId: payload.metadata.phone_number_id,
    to: message.from,
    answer,
  });
  await publishTenantEvent(realtimePublisher, tenantId, {
    type: "conversation.updated",
    conversationId: conversation.id,
  });
}

async function markWaitingForHuman(
  tenantId: string,
  conversationId: string,
  reason: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.conversation.updateMany({
      where: { id: conversationId, tenantId },
      data: { status: "WAITING_HUMAN", needsHumanReason: reason },
    }),
    prisma.auditLog.create({
      data: {
        tenantId,
        action: "conversation.transferred_to_human",
        resourceType: "conversation",
        resourceId: conversationId,
        metadata: { reason, source: "AI" },
      },
    }),
  ]);
}

async function sendAutomatedAnswer(input: {
  tenantId: string;
  conversationId: string;
  phoneNumberId: string;
  to: string;
  answer: { answer: string; canAnswer: boolean; confidence: number; needsHuman: boolean; reason: string };
}): Promise<void> {
  await outboundService.send({
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    phoneNumberId: input.phoneNumberId,
    to: input.to,
    body: input.answer.answer,
    sender: "AI",
    ai: {
      confidence: input.answer.confidence,
      canAnswer: input.answer.canAnswer,
      needsHuman: input.answer.needsHuman,
      reason: input.answer.reason,
    },
  });
}

async function processStatus(
  tenantId: string,
  externalEventId: string,
  payload: z.infer<typeof webhookValueSchema>,
): Promise<void> {
  const parts = externalEventId.split(":");
  const messageId = parts[1];
  const statusValue = parts[2];
  if (!messageId || !statusValue) return;
  const statusMap = {
    sent: "SENT",
    delivered: "DELIVERED",
    read: "READ",
    failed: "FAILED",
  } as const;
  const mapped = statusMap[statusValue as keyof typeof statusMap];
  if (!mapped || !payload.statuses?.some((status) => status.id === messageId)) return;
  await prisma.message.updateMany({
    where: { tenantId, externalMessageId: messageId },
    data: { status: mapped },
  });
}
