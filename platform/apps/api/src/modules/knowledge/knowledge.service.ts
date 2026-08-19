import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../core/errors/app-error.js";
import type { TenantContext } from "../../core/tenant/tenant-context.js";
import { prisma } from "../../infra/database/prisma.js";
import type { z } from "zod";
import type {
  businessHourExceptionSchema,
  businessHourSchema,
  companyProfileSchema,
  faqPatchSchema,
  faqSchema,
  productPatchSchema,
  productSchema,
  servicePatchSchema,
  serviceSchema,
} from "./knowledge.schemas.js";

type ProductInput = z.infer<typeof productSchema>;
type ServiceInput = z.infer<typeof serviceSchema>;
type FaqInput = z.infer<typeof faqSchema>;
type HourInput = z.infer<typeof businessHourSchema>;
type HourExceptionInput = z.infer<typeof businessHourExceptionSchema>;
type CompanyProfileInput = z.infer<typeof companyProfileSchema>;
type ProductPatch = z.infer<typeof productPatchSchema>;
type ServicePatch = z.infer<typeof servicePatchSchema>;
type FaqPatch = z.infer<typeof faqPatchSchema>;

const imageSelect = { id: true, secureUrl: true, width: true, height: true } as const;
const noMatchId = "00000000-0000-0000-0000-000000000000";

export class KnowledgeService {
  async list(context: TenantContext) {
    const tenantId = context.tenantId;
    const [businessHours, businessHourExceptions, companyProfile] = await prisma.$transaction([
      prisma.businessHour.findMany({ where: { tenantId }, orderBy: { weekday: "asc" } }),
      prisma.businessHourException.findMany({ where: { tenantId }, orderBy: { date: "asc" }, take: 100 }),
      prisma.companyProfile.findUnique({ where: { tenantId } }),
    ]);
    return { businessHours, businessHourExceptions, companyProfile };
  }

  async listProducts(context: TenantContext, input: KnowledgeListInput) {
    const items = await prisma.product.findMany({
      where: {
        tenantId: context.tenantId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.category ? { category: { equals: input.category, mode: "insensitive" } } : {}),
        ...(input.search ? { OR: [
          { name: { contains: input.search, mode: "insensitive" } },
          { description: { contains: input.search, mode: "insensitive" } },
          { category: { contains: input.search, mode: "insensitive" } },
        ] } : {}),
      },
      include: { imageAsset: { select: imageSelect } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    return paginated(items, input.limit);
  }

  async listServices(context: TenantContext, input: KnowledgeListInput) {
    const items = await prisma.service.findMany({
      where: {
        tenantId: context.tenantId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.category ? { category: { equals: input.category, mode: "insensitive" } } : {}),
        ...(input.search ? { OR: [
          { name: { contains: input.search, mode: "insensitive" } },
          { description: { contains: input.search, mode: "insensitive" } },
          { category: { contains: input.search, mode: "insensitive" } },
        ] } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    return paginated(items, input.limit);
  }

  async listFaqs(context: TenantContext, input: KnowledgeListInput) {
    const items = await prisma.faq.findMany({
      where: {
        tenantId: context.tenantId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.category ? { category: { equals: input.category, mode: "insensitive" } } : {}),
        ...(input.search ? { OR: [
          { question: { contains: input.search, mode: "insensitive" } },
          { answer: { contains: input.search, mode: "insensitive" } },
          { category: { contains: input.search, mode: "insensitive" } },
        ] } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    return paginated(items, input.limit);
  }

  async createProduct(context: TenantContext, input: ProductInput) {
    await this.assertImage(context, input.imageAssetId);
    const product = await prisma.product.create({
      data: {
        tenantId: context.tenantId,
        name: input.name,
        description: input.description,
        category: input.category,
        currency: input.currency.toUpperCase(),
        status: input.status,
        available: input.available,
        imageAssetId: input.imageAssetId,
        price: input.price,
      },
      include: { imageAsset: { select: imageSelect } },
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
        category: input.category,
        currency: input.currency.toUpperCase(),
        status: input.status,
        available: input.available,
        durationMinutes: input.durationMinutes,
        price: input.price,
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

  async updateCompanyProfile(context: TenantContext, input: CompanyProfileInput) {
    const companyProfile = await prisma.companyProfile.upsert({
      where: { tenantId: context.tenantId },
      create: { tenantId: context.tenantId, ...input },
      update: input,
    });
    await this.audit(context, "knowledge.company_profile_updated", "company_profile", context.tenantId);
    return companyProfile;
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

  async upsertBusinessHourException(context: TenantContext, input: HourExceptionInput) {
    const date = new Date(`${input.date}T00:00:00.000Z`);
    const exception = await prisma.businessHourException.upsert({
      where: { tenantId_date: { tenantId: context.tenantId, date } },
      create: {
        tenantId: context.tenantId,
        date,
        label: input.label,
        opensAt: input.opensAt,
        closesAt: input.closesAt,
        isClosed: input.isClosed,
      },
      update: { label: input.label, opensAt: input.opensAt, closesAt: input.closesAt, isClosed: input.isClosed },
    });
    await this.audit(context, "knowledge.business_hour_exception_updated", "business_hour_exception", exception.id);
    return exception;
  }

  async removeBusinessHourException(context: TenantContext, id: string): Promise<void> {
    await ensureChanged(prisma.businessHourException.deleteMany({ where: { id, tenantId: context.tenantId } }));
    await this.audit(context, "knowledge.business_hour_exception_deleted", "business_hour_exception", id);
  }

  async updateProduct(context: TenantContext, id: string, input: ProductPatch) {
    if (input.imageAssetId !== undefined) await this.assertImage(context, input.imageAssetId);
    const data: Prisma.ProductUpdateManyMutationInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.currency !== undefined ? { currency: input.currency.toUpperCase() } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.available !== undefined ? { available: input.available } : {}),
      ...(input.imageAssetId !== undefined ? { imageAssetId: input.imageAssetId } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
    };
    await ensureChanged(prisma.product.updateMany({ where: { id, tenantId: context.tenantId }, data }));
    const product = await prisma.product.findFirstOrThrow({
      where: { id, tenantId: context.tenantId },
      include: { imageAsset: { select: imageSelect } },
    });
    await this.audit(context, "knowledge.product_updated", "product", id);
    return product;
  }

  async updateService(context: TenantContext, id: string, input: ServicePatch) {
    const data: Prisma.ServiceUpdateManyMutationInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.currency !== undefined ? { currency: input.currency.toUpperCase() } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.available !== undefined ? { available: input.available } : {}),
      ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
    };
    await ensureChanged(prisma.service.updateMany({ where: { id, tenantId: context.tenantId }, data }));
    const service = await prisma.service.findFirstOrThrow({ where: { id, tenantId: context.tenantId } });
    await this.audit(context, "knowledge.service_updated", "service", id);
    return service;
  }

  async updateFaq(context: TenantContext, id: string, input: FaqPatch) {
    const data: Prisma.FaqUpdateManyMutationInput = {
      ...(input.question !== undefined ? { question: input.question } : {}),
      ...(input.answer !== undefined ? { answer: input.answer } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
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
    const tokens = tokenize(question).slice(0, 8);
    const productFilters = tokens.flatMap((token) => [
      { name: { contains: token, mode: "insensitive" as const } },
      { description: { contains: token, mode: "insensitive" as const } },
      { category: { contains: token, mode: "insensitive" as const } },
    ]);
    const faqFilters = tokens.flatMap((token) => [
      { question: { contains: token, mode: "insensitive" as const } },
      { answer: { contains: token, mode: "insensitive" as const } },
      { category: { contains: token, mode: "insensitive" as const } },
    ]);
    const asksHours = /hor[aá]rio|abert[oa]|fech[ao]|funciona|feriado/iu.test(question);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [tenant, products, services, faqs, businessHours, businessHourExceptions, companyProfile] = await prisma.$transaction([
      prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { id: true, name: true, timezone: true },
      }),
      prisma.product.findMany({
        where: { tenantId, status: "ACTIVE", ...(productFilters.length ? { OR: productFilters } : { id: noMatchId }) },
        select: { id: true, name: true, description: true, category: true, available: true, price: true, currency: true },
        take: 10,
      }),
      prisma.service.findMany({
        where: { tenantId, status: "ACTIVE", ...(productFilters.length ? { OR: productFilters } : { id: noMatchId }) },
        select: { id: true, name: true, description: true, category: true, available: true, durationMinutes: true, price: true, currency: true },
        take: 10,
      }),
      prisma.faq.findMany({
        where: { tenantId, status: "ACTIVE", ...(faqFilters.length ? { OR: faqFilters } : { id: noMatchId }) },
        select: { id: true, question: true, answer: true, category: true },
        orderBy: { sortOrder: "asc" },
        take: 10,
      }),
      prisma.businessHour.findMany({
        where: asksHours ? { tenantId } : { tenantId, id: noMatchId },
        select: { weekday: true, opensAt: true, closesAt: true, isClosed: true },
        orderBy: { weekday: "asc" },
      }),
      prisma.businessHourException.findMany({
        where: asksHours ? { tenantId, date: { gte: today } } : { tenantId, id: noMatchId },
        select: { date: true, label: true, opensAt: true, closesAt: true, isClosed: true },
        orderBy: { date: "asc" },
        take: 20,
      }),
      prisma.companyProfile.findUnique({ where: { tenantId } }),
    ]);

    const companyRelevant = isCompanyProfileRelevant(question, tokens, tenant.name, companyProfile);
    return {
      tenant,
      products,
      services,
      faqs,
      businessHours,
      businessHourExceptions,
      companyProfile: companyRelevant ? companyProfile : null,
      hasRelevantContext:
        products.length > 0 || services.length > 0 || faqs.length > 0 || businessHours.length > 0 ||
        businessHourExceptions.length > 0 || companyRelevant,
    };
  }

  private async assertImage(context: TenantContext, imageAssetId: string | null): Promise<void> {
    if (!imageAssetId) return;
    const asset = await prisma.mediaAsset.findFirst({
      where: { id: imageAssetId, tenantId: context.tenantId, resourceType: "image" },
      select: { id: true },
    });
    if (!asset) throw new AppError(422, "INVALID_IMAGE", "Selecione uma imagem pertencente a esta empresa");
  }

  private async audit(
    context: TenantContext,
    action: string,
    resourceType: string,
    resourceId: string,
  ): Promise<void> {
    await prisma.auditLog.create({
      data: { tenantId: context.tenantId, actorUserId: context.userId, action, resourceType, resourceId },
    });
  }
}

function tokenize(value: string): string[] {
  return Array.from(new Set(value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length >= 3)));
}

function isCompanyProfileRelevant(
  question: string,
  tokens: string[],
  tenantName: string,
  profile: { description: string | null; address: string | null; phoneE164: string | null; email: string | null; policies: string | null; usefulLinks: Prisma.JsonValue } | null,
): boolean {
  if (/nome (da|de sua) empresa|qual (é|e) a empresa/iu.test(question)) return Boolean(tenantName);
  if (!profile) return false;
  if (/endere[cç]o|localiza|onde fica/iu.test(question) && profile.address) return true;
  if (/telefone|whatsapp|e-?mail|contato/iu.test(question) && (profile.phoneE164 || profile.email)) return true;
  if (/pol[ií]tica|troca|devolu|cancelamento|garantia/iu.test(question) && profile.policies) return true;
  if (/site|link|rede social|instagram|facebook/iu.test(question) && Array.isArray(profile.usefulLinks) && profile.usefulLinks.length > 0) return true;
  if (/sobre (a|sua) empresa|o que (faz|voc[eê]s fazem)/iu.test(question) && profile.description) return true;
  const searchable = JSON.stringify(profile).normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
  return tokens.some((token) => searchable.includes(token));
}

async function ensureChanged(operation: Promise<{ count: number }>): Promise<void> {
  const result = await operation;
  if (result.count !== 1) throw new AppError(404, "NOT_FOUND", "Item não encontrado");
}

type KnowledgeListInput = {
  search?: string | undefined;
  category?: string | undefined;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED" | undefined;
  cursor?: string | undefined;
  limit: number;
};

function paginated<T extends { id: string }>(items: T[], limit: number): { items: T[]; nextCursor: string | null } {
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  return { items: page, nextCursor: hasMore ? page.at(-1)?.id ?? null : null };
}
