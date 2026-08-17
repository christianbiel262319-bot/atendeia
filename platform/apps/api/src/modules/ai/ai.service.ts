import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../../infra/database/prisma.js";
import { KnowledgeService } from "../knowledge/knowledge.service.js";
import { aiAnswerSchema, applyConfidencePolicy, type AiAnswer } from "./ai.contract.js";
import { buildAiInstructions } from "./prompt.js";
import type { z } from "zod";
import type { aiConfigurationSchema } from "./ai.schemas.js";
import type { TenantContext } from "../../core/tenant/tenant-context.js";

const knowledgeService = new KnowledgeService();
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 20_000, maxRetries: 2 });

export class AiService {
  async getConfiguration(context: TenantContext) {
    return prisma.aiConfiguration.findUnique({ where: { tenantId: context.tenantId } });
  }

  async updateConfiguration(
    context: TenantContext,
    input: z.infer<typeof aiConfigurationSchema>,
  ) {
    const configuration = await prisma.aiConfiguration.upsert({
      where: { tenantId: context.tenantId },
      create: { tenantId: context.tenantId, ...input },
      update: input,
    });
    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        actorUserId: context.userId,
        action: "ai.configuration_updated",
        resourceType: "ai_configuration",
        resourceId: configuration.id,
        metadata: { enabled: configuration.enabled },
      },
    });
    return configuration;
  }

  async answer(input: {
    tenantId: string;
    question: string;
    history: Array<{ sender: string; body: string }>;
  }): Promise<AiAnswer> {
    const configuration = await prisma.aiConfiguration.findUnique({
      where: { tenantId: input.tenantId },
    });
    const transferMessage =
      configuration?.transferMessage ??
      "Não encontrei essa informação com segurança. Vou encaminhar sua conversa para uma pessoa da equipe.";

    if (!configuration?.enabled) {
      return {
        answer: transferMessage,
        canAnswer: false,
        confidence: 0,
        needsHuman: true,
        reason: "AI_DISABLED",
      };
    }

    const context = await knowledgeService.buildContext(input.tenantId, input.question);
    if (!context.hasRelevantContext) {
      return {
        answer: configuration.fallbackMessage ?? transferMessage,
        canAnswer: false,
        confidence: 0,
        needsHuman: true,
        reason: "NO_RELEVANT_CONTEXT",
      };
    }

    try {
      const response = await openai.responses.parse({
        model: env.OPENAI_MODEL,
        store: false,
        reasoning: { effort: "low" },
        instructions: buildAiInstructions(configuration.tone),
        input: [
          {
            role: "user",
            content: JSON.stringify({
              CONTEXTO_DA_EMPRESA: context,
              HISTORICO_RECENTE: input.history.slice(-configuration.maxContextMessages),
              MENSAGEM_DO_CLIENTE: input.question,
            }),
          },
        ],
        text: { format: zodTextFormat(aiAnswerSchema, "atendeia_answer") },
      });
      if (!response.output_parsed) {
        return {
          answer: transferMessage,
          canAnswer: false,
          confidence: 0,
          needsHuman: true,
          reason: "MODEL_REFUSAL_OR_INCOMPLETE",
        };
      }
      const parsed = aiAnswerSchema.parse(response.output_parsed);
      return applyConfidencePolicy(parsed, Number(configuration.minimumConfidence), transferMessage);
    } catch (error) {
      logger.error({ error, tenantId: input.tenantId }, "AI response failed");
      return {
        answer: transferMessage,
        canAnswer: false,
        confidence: 0,
        needsHuman: true,
        reason: "AI_PROVIDER_ERROR",
      };
    }
  }
}
