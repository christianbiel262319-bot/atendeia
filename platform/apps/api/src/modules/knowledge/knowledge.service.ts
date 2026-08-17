import { AppError } from "../../core/errors/app-error.js";
import type { TenantContext } from "../../core/tenant/tenant-context.js";
import { prisma } from "../../infra/database/prisma.js";
import type { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import type {
  businessHourSchema,
  faqSchema,
  faqPatchSchema,
  productSchema,
  productPatchSchema,
  serviceSchema,
  servicePatchSchema,
} from "./knowledge.schemas.js";

type ProductInput = z.infer<typeof productSchema>;
type ServiceInput = z.infer<typeof serviceSchema>;
type FaqInput = z.infer<typeof faqSchema>;
type HourInput = z.infer<typeof businessHourSchema>;
type ProductPatch = z.infer<typeof productPatchSchema>;
type ServicePatch = z.infer<typeof servicePatchSchema>;
type FaqPatch = z.infer<typeof faqPatchSchema>;

export class KnowledgeService {
  async list(context: TenantContext) {
    const tenantId = context.tenantId;
    const [products, services, faqs, businessHours] = await prisma.$transaction([
      prisma.product.findMany({ where: { tenantId }, orderBy: { updatedAt: "desc" } }),
      prisma.service.findMany({ where: { tenantId }, orderBy: { updatedAt: "desc" } }),
      prisma.faq.findMany({ where: { tenantId }, orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }] }),
      prisma.businessHour.findMany({ where: { tenantId }, orderBy: { weekday: "asc" } }),
    ]);
    return { products, services, faqs, businessHours };
  }

  async createProduct(context: TenantContext, input: ProductInput) {
    const product = await prisma.product.create({
      data: {
        tenantId: context.tenantId,
        name: input.name,
        description: input.description,
        currency: input.currency,
        status: input.status,
        price: input.price ?? null,
      },
    });
    await this.audit(context, "knowledge.product_created", "product", product.id);
    return product;
  }

  async createService(context: TenantContext, input: ServiceInput) {
    const service = await prisma.service.create({
      data: {
        tenantId: context.tenantId,
        name: input.name,
        description: input.description,
        currency: input.currency,
        status: input.status,
        durationMinutes: input.durationMinutes ?? null,
        price: input.price ?? null,
      },
    });
    await this.audit(context, "knowledge.service_created", "service", service.id);
    return service;
  }

  async createFaq(context: TenantContext, input: FaqInput) {
    const faq = await prisma.faq.create({ data: { tenantId: context.tenantId, ...input } });
    await this.audit(context, "knowledge.faq_created", "faq", faq.id);
    return faq;
  }

  async upsertBusinessHour(context: TenantContext, input: HourInput) {
    const hour = await prisma.businessHour.upsert({
      where: { tenantId_weekday: { tenantId: context.tenantId, weekday: input.weekday } },
      create: { tenantId: context.tenantId, ...input },
      update: input,
    });
    await this.audit(context, "knowledge.business_hour_updated", "business_hour", hour.id);
    return hour;
  }

  async updateProduct(context: TenantContext, id: string, input: ProductPatch) {
    const data: Prisma.ProductUpdateManyMutationInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
    };
    await ensureChanged(
      prisma.product.updateMany({ where: { id, tenantId: context.tenantId }, data }),
    );
    const product = await prisma.product.findFirstOrThrow({ where: { id, tenantId: context.tenantId } });
    await this.audit(context, "knowledge.product_updated", "product", id);
    return product;
  }

  async updateService(context: TenantContext, id: string, input: ServicePatch) {
    const data: Prisma.ServiceUpdateManyMutationInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
    };
    await ensureChanged(
      prisma.service.updateMany({ where: { id, tenantId: context.tenantId }, data }),
    );
    const service = await prisma.service.findFirstOrThrow({ where: { id, tenantId: context.tenantId } });
    await this.audit(context, "knowledge.service_updated", "service", id);
    return service;
  }

  async updateFaq(context: TenantContext, id: string, input: FaqPatch) {
    const data: Prisma.FaqUpdateManyMutationInput = {
      ...(input.question !== undefined ? { question: input.question } : {}),
      ...(input.answer !== undefined ? { answer: input.answer } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    };
    await ensureChanged(prisma.faq.updateMany({ where: { id, tenantId: context.tenantId }, data }));
    const faq = await prisma.faq.findFirstOrThrow({ where: { id, tenantId: context.tenantId } });
    await this.audit(context, "knowledge.faq_updated", "faq", id);
    return faq;
  }

  async remove(context: TenantContext, resource: "product" | "service" | "faq", id: string) {
    const where = { id, tenantId: context.tenantId };
    const result =
      resource === "product"
        ? await prisma.product.deleteMany({ where })
        : resource === "service"
          ? await prisma.service.deleteMany({ where })
          : await prisma.faq.deleteMany({ where });
    if (result.count !== 1) throw new AppError(404, "NOT_FOUND", "Item não encontrado");
    await this.audit(context, `knowledge.${resource}_deleted`, resource, id);
  }

  async buildContext(tenantId: string, question: string) {
    const tokens = Array.from(
      new Set(
        question
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/gu, "")
          .toLowerCase()
          .split(/[^a-z0-9]+/u)
          .filter((token) => token.length >= 3),
      ),
    ).slice(0, 8);
    const productFilters = tokens.flatMap((token) => [
      { name: { contains: token, mode: "insensitive" as const } },
      { description: { contains: token, mode: "insensitive" as const } },
    ]);
    const faqFilters = tokens.flatMap((token) => [
      { question: { contains: token, mode: "insensitive" as const } },
      { answer: { contains: token, mode: "insensitive" as const } },
    ]);
    const asksHours = /hor[aá]rio|abert[oa]|fech[ao]|funciona/iu.test(question);

    const [tenant, products, services, faqs, businessHours] = await prisma.$transaction([
      prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { id: true, name: true, timezone: true },
      }),
      prisma.product.findMany({
        where: { tenantId, status: "ACTIVE", ...(productFilters.length ? { OR: productFilters } : { id: "__none__" }) },
        select: { id: true, name: true, description: true, price: true, currency: true },
        take: 10,
      }),
      prisma.service.findMany({
        where: { tenantId, status: "ACTIVE", ...(productFilters.length ? { OR: productFilters } : { id: "__none__" }) },
        select: { id: true, name: true, description: true, durationMinutes: true, price: true, currency: true },
        take: 10,
      }),
      prisma.faq.findMany({
        where: { tenantId, status: "ACTIVE", ...(faqFilters.length ? { OR: faqFilters } : { id: "__none__" }) },
        select: { id: true, question: true, answer: true },
        orderBy: { sortOrder: "asc" },
        take: 10,
      }),
      prisma.businessHour.findMany({
        where: { tenantId },
        select: { weekday: true, opensAt: true, closesAt: true, isClosed: true },
        orderBy: { weekday: "asc" },
      }),
    ]);

    return {
      tenant,
      products,
      services,
      faqs,
      businessHours: asksHours ? businessHours : [],
      hasRelevantContext:
        products.length > 0 || services.length > 0 || faqs.length > 0 || (asksHours && businessHours.length > 0),
    };
  }

  private async audit(
    context: TenantContext,
    action: string,
    resourceType: string,
    resourceId: string,
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        actorUserId: context.userId,
        action,
        resourceType,
        resourceId,
      },
    });
  }
}

async function ensureChanged(operation: Promise<{ count: number }>): Promise<void> {
  const result = await operation;
  if (result.count !== 1) throw new AppError(404, "NOT_FOUND", "Item não encontrado");
}
