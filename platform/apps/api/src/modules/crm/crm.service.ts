import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../core/errors/app-error.js";
import type { TenantContext } from "../../core/tenant/tenant-context.js";
import { prisma } from "../../infra/database/prisma.js";
import { normalizeTags } from "./crm.schemas.js";

type ContactListInput = {
  search?: string | undefined;
  tag?: string | undefined;
  source?: "WHATSAPP" | "MANUAL" | "IMPORT" | "API" | undefined;
  archived: boolean;
  cursor?: string | undefined;
  limit: number;
};

type ContactMutationInput = {
  displayName?: string | null | undefined;
  phoneE164?: string | undefined;
  email?: string | null | undefined;
  tags?: string[] | undefined;
};

const contactSummarySelect = {
  id: true,
  displayName: true,
  phoneE164: true,
  email: true,
  tags: true,
  source: true,
  lastInteractionAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { conversations: true, notes: true } },
} satisfies Prisma.ContactSelect;

export class CrmService {
  async list(context: TenantContext, input: ContactListInput) {
    const contacts = await prisma.contact.findMany({
      where: {
        tenantId: context.tenantId,
        archivedAt: input.archived ? { not: null } : null,
        ...(input.tag ? { tags: { has: input.tag } } : {}),
        ...(input.source ? { source: input.source } : {}),
        ...(input.search
          ? {
              OR: [
                { displayName: { contains: input.search, mode: "insensitive" as const } },
                { phoneE164: { contains: input.search } },
                { email: { contains: input.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: contactSummarySelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const hasMore = contacts.length > input.limit;
    const items = hasMore ? contacts.slice(0, input.limit) : contacts;
    return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
  }

  async get(context: TenantContext, id: string) {
    const contact = await prisma.contact.findFirst({
      where: { id, tenantId: context.tenantId },
      select: {
        ...contactSummarySelect,
        notes: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            body: true,
            authorUserId: true,
            createdAt: true,
            updatedAt: true,
            author: { select: { user: { select: { fullName: true } } } },
          },
        },
        conversations: {
          orderBy: { updatedAt: "desc" },
          take: 20,
          select: {
            id: true,
            status: true,
            openedAt: true,
            resolvedAt: true,
            updatedAt: true,
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { body: true, sender: true, createdAt: true },
            },
          },
        },
      },
    });
    if (!contact) throw new AppError(404, "NOT_FOUND", "Contato não encontrado");
    return contact;
  }

  async create(
    context: TenantContext,
    input: { displayName: string; phoneE164: string; email?: string | null | undefined; tags: string[] },
  ) {
    const contact = await prisma.contact.create({
      data: {
        tenantId: context.tenantId,
        whatsappUserId: input.phoneE164.slice(1),
        phoneE164: input.phoneE164,
        displayName: input.displayName,
        email: input.email?.toLocaleLowerCase("pt-BR") ?? null,
        tags: normalizeTags(input.tags),
        source: "MANUAL",
      },
      select: contactSummarySelect,
    });
    await this.audit(context, "crm.contact_created", contact.id);
    return contact;
  }

  async update(context: TenantContext, id: string, input: ContactMutationInput) {
    const existing = await prisma.contact.findFirst({
      where: { id, tenantId: context.tenantId },
      select: { source: true },
    });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Contato não encontrado");
    if (input.phoneE164 && existing.source === "WHATSAPP") {
      throw new AppError(409, "SYNCED_PHONE", "O telefone deste contato é sincronizado pelo WhatsApp");
    }
    const data: Prisma.ContactUpdateManyMutationInput = {
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.email !== undefined ? { email: input.email?.toLocaleLowerCase("pt-BR") ?? null } : {}),
      ...(input.tags !== undefined ? { tags: normalizeTags(input.tags) } : {}),
      ...(input.phoneE164 ? { phoneE164: input.phoneE164, whatsappUserId: input.phoneE164.slice(1) } : {}),
    };
    await ensureChanged(prisma.contact.updateMany({ where: { id, tenantId: context.tenantId }, data }));
    const contact = await prisma.contact.findFirstOrThrow({
      where: { id, tenantId: context.tenantId },
      select: contactSummarySelect,
    });
    await this.audit(context, "crm.contact_updated", id);
    return contact;
  }

  async addNote(context: TenantContext, contactId: string, body: string) {
    await this.assertContact(context, contactId);
    const note = await prisma.contactNote.create({
      data: { tenantId: context.tenantId, contactId, authorUserId: context.userId, body },
      select: {
        id: true,
        body: true,
        authorUserId: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { user: { select: { fullName: true } } } },
      },
    });
    await this.audit(context, "crm.contact_note_created", note.id, { contactId });
    return note;
  }

  async removeNote(context: TenantContext, contactId: string, noteId: string): Promise<void> {
    const note = await prisma.contactNote.findFirst({
      where: { id: noteId, contactId, tenantId: context.tenantId },
      select: { authorUserId: true },
    });
    if (!note) throw new AppError(404, "NOT_FOUND", "Nota não encontrada");
    const canRemoveAny = ["OWNER", "ADMIN", "MANAGER"].includes(context.role);
    if (!canRemoveAny && note.authorUserId !== context.userId) {
      throw new AppError(403, "FORBIDDEN", "Você só pode excluir suas próprias notas");
    }
    await prisma.contactNote.deleteMany({ where: { id: noteId, contactId, tenantId: context.tenantId } });
    await this.audit(context, "crm.contact_note_deleted", noteId, { contactId });
  }

  async archive(context: TenantContext, id: string) {
    await this.assertContact(context, id);
    const activeConversation = await prisma.conversation.findFirst({
      where: { tenantId: context.tenantId, contactId: id, status: { in: ["OPEN", "WAITING_HUMAN", "WITH_HUMAN"] } },
      select: { id: true },
    });
    if (activeConversation) {
      throw new AppError(409, "ACTIVE_CONVERSATION", "Encerre o atendimento ativo antes de arquivar o contato");
    }
    await ensureChanged(prisma.contact.updateMany({
      where: { id, tenantId: context.tenantId, archivedAt: null },
      data: { archivedAt: new Date() },
    }), "Contato já está arquivado");
    await this.audit(context, "crm.contact_archived", id);
    return this.get(context, id);
  }

  async restore(context: TenantContext, id: string) {
    await ensureChanged(prisma.contact.updateMany({
      where: { id, tenantId: context.tenantId, archivedAt: { not: null } },
      data: { archivedAt: null },
    }), "Contato não está arquivado");
    await this.audit(context, "crm.contact_restored", id);
    return this.get(context, id);
  }

  private async assertContact(context: TenantContext, id: string): Promise<void> {
    const contact = await prisma.contact.findFirst({ where: { id, tenantId: context.tenantId }, select: { id: true } });
    if (!contact) throw new AppError(404, "NOT_FOUND", "Contato não encontrado");
  }

  private async audit(
    context: TenantContext,
    action: string,
    resourceId: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        actorUserId: context.userId,
        action,
        resourceType: "contact",
        resourceId,
        ...(metadata ? { metadata } : {}),
      },
    });
  }
}

async function ensureChanged(operation: Promise<{ count: number }>, message = "Contato não encontrado"): Promise<void> {
  const result = await operation;
  if (result.count !== 1) throw new AppError(404, "NOT_FOUND", message);
}
