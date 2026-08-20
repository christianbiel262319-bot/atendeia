import { DEMO_BACKEND_MESSAGE } from "./demo-mode";

export class DemoBackendRequiredError extends Error {
  readonly code = "DEMO_BACKEND_REQUIRED";
  readonly status = 503;

  constructor() {
    super(DEMO_BACKEND_MESSAGE);
    this.name = "DemoBackendRequiredError";
  }
}

const conversations = [
  {
    id: "00000000-0000-4000-8000-00000000c001",
    status: "WAITING_HUMAN",
    needsHumanReason: "DEMO — a pergunta não possui contexto comercial suficiente.",
    updatedAt: "2026-08-19T18:42:00.000Z",
    contact: {
      id: "00000000-0000-4000-8000-000000001001",
      displayName: "Cliente Demonstração 01 — DEMO",
      phoneE164: "+5511900000001",
      tags: ["DEMO", "Orçamento"],
    },
    messages: [
      { body: "DEMO — Vocês fazem entrega para outras cidades?", sender: "CONTACT", createdAt: "2026-08-19T18:42:00.000Z", status: "DELIVERED" },
    ],
  },
  {
    id: "00000000-0000-4000-8000-00000000c002",
    status: "WITH_HUMAN",
    needsHumanReason: "DEMO — cliente solicitou atendimento humano.",
    updatedAt: "2026-08-19T17:15:00.000Z",
    contact: {
      id: "00000000-0000-4000-8000-000000001002",
      displayName: "Cliente Demonstração 02 — DEMO",
      phoneE164: "+5511900000002",
      tags: ["DEMO", "Prioridade"],
    },
    messages: [
      { body: "DEMO — Gostaria de falar com uma pessoa.", sender: "CONTACT", createdAt: "2026-08-19T17:15:00.000Z", status: "READ" },
    ],
  },
  {
    id: "00000000-0000-4000-8000-00000000c003",
    status: "RESOLVED",
    needsHumanReason: null,
    updatedAt: "2026-08-18T15:30:00.000Z",
    contact: {
      id: "00000000-0000-4000-8000-000000001003",
      displayName: "Cliente Demonstração 03 — DEMO",
      phoneE164: "+5511900000003",
      tags: ["DEMO", "Cliente"],
    },
    messages: [
      { body: "DEMO — Obrigado pelas informações!", sender: "CONTACT", createdAt: "2026-08-18T15:30:00.000Z", status: "READ" },
    ],
  },
];

const conversationDetails = conversations.map((conversation, index) => ({
  ...conversation,
  messages: index === 0
    ? [
        { id: "demo-msg-001", body: "DEMO — Olá! Qual é o horário de atendimento?", sender: "CONTACT", direction: "INBOUND", status: "READ", createdAt: "2026-08-19T18:38:00.000Z", aiConfidence: null },
        { id: "demo-msg-002", body: "DEMO — Atendemos de segunda a sexta, das 9h às 18h.", sender: "AI", direction: "OUTBOUND", status: "DELIVERED", createdAt: "2026-08-19T18:39:00.000Z", aiConfidence: "0.94" },
        { id: "demo-msg-003", body: "DEMO — Vocês fazem entrega para outras cidades?", sender: "CONTACT", direction: "INBOUND", status: "DELIVERED", createdAt: "2026-08-19T18:42:00.000Z", aiConfidence: null },
      ]
    : index === 1
      ? [
          { id: "demo-msg-004", body: "DEMO — Preciso alterar meu pedido.", sender: "CONTACT", direction: "INBOUND", status: "READ", createdAt: "2026-08-19T17:12:00.000Z", aiConfidence: null },
          { id: "demo-msg-005", body: "DEMO — Vou transferir seu atendimento para nossa equipe.", sender: "AI", direction: "OUTBOUND", status: "READ", createdAt: "2026-08-19T17:13:00.000Z", aiConfidence: "0.41" },
          { id: "demo-msg-006", body: "DEMO — Gostaria de falar com uma pessoa.", sender: "CONTACT", direction: "INBOUND", status: "READ", createdAt: "2026-08-19T17:15:00.000Z", aiConfidence: null },
        ]
      : [
          { id: "demo-msg-007", body: "DEMO — Qual o preço da consultoria inicial?", sender: "CONTACT", direction: "INBOUND", status: "READ", createdAt: "2026-08-18T15:24:00.000Z", aiConfidence: null },
          { id: "demo-msg-008", body: "DEMO — A consultoria inicial demonstrativa custa R$ 150,00.", sender: "AI", direction: "OUTBOUND", status: "READ", createdAt: "2026-08-18T15:25:00.000Z", aiConfidence: "0.97" },
          { id: "demo-msg-009", body: "DEMO — Obrigado pelas informações!", sender: "CONTACT", direction: "INBOUND", status: "READ", createdAt: "2026-08-18T15:30:00.000Z", aiConfidence: null },
        ],
}));

const contacts = [
  {
    id: "00000000-0000-4000-8000-000000001001",
    displayName: "Cliente Demonstração 01 — DEMO",
    phoneE164: "+5511900000001",
    email: "cliente01@demo.invalid",
    tags: ["DEMO", "Orçamento"],
    source: "WHATSAPP",
    lastInteractionAt: "2026-08-19T18:42:00.000Z",
    archivedAt: null,
    createdAt: "2026-08-10T13:00:00.000Z",
    updatedAt: "2026-08-19T18:42:00.000Z",
    _count: { conversations: 2, notes: 1 },
  },
  {
    id: "00000000-0000-4000-8000-000000001002",
    displayName: "Cliente Demonstração 02 — DEMO",
    phoneE164: "+5511900000002",
    email: "cliente02@demo.invalid",
    tags: ["DEMO", "Prioridade"],
    source: "MANUAL",
    lastInteractionAt: "2026-08-19T17:15:00.000Z",
    archivedAt: null,
    createdAt: "2026-08-12T15:20:00.000Z",
    updatedAt: "2026-08-19T17:15:00.000Z",
    _count: { conversations: 1, notes: 2 },
  },
  {
    id: "00000000-0000-4000-8000-000000001003",
    displayName: "Cliente Demonstração 03 — DEMO",
    phoneE164: "+5511900000003",
    email: null,
    tags: ["DEMO", "Cliente"],
    source: "IMPORT",
    lastInteractionAt: "2026-08-18T15:30:00.000Z",
    archivedAt: null,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-18T15:30:00.000Z",
    _count: { conversations: 1, notes: 0 },
  },
  {
    id: "00000000-0000-4000-8000-000000001004",
    displayName: "Contato Arquivado — DEMO",
    phoneE164: "+5511900000004",
    email: "arquivado@demo.invalid",
    tags: ["DEMO", "Arquivado"],
    source: "API",
    lastInteractionAt: "2026-07-14T11:00:00.000Z",
    archivedAt: "2026-08-01T09:00:00.000Z",
    createdAt: "2026-07-10T09:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z",
    _count: { conversations: 0, notes: 1 },
  },
] as const;

const products = [
  { id: "demo-product-001", name: "Produto Essencial — DEMO", description: "Produto demonstrativo usado apenas para avaliar a interface.", category: "DEMO", price: "89.90", available: true, imageAssetId: null, imageAsset: null, status: "ACTIVE" },
  { id: "demo-product-002", name: "Produto Premium — DEMO", description: "Exemplo visual de produto temporariamente indisponível.", category: "DEMO", price: "159.90", available: false, imageAssetId: null, imageAsset: null, status: "DRAFT" },
];

const services = [
  { id: "demo-service-001", name: "Consultoria inicial — DEMO", description: "Atendimento demonstrativo para levantamento de necessidades.", category: "DEMO", price: "150.00", durationMinutes: 60, available: true, status: "ACTIVE" },
  { id: "demo-service-002", name: "Suporte especializado — DEMO", description: "Serviço demonstrativo de suporte agendado.", category: "DEMO", price: null, durationMinutes: 30, available: true, status: "ACTIVE" },
];

const faqs = [
  { id: "demo-faq-001", question: "Qual é o horário de atendimento? — DEMO", answer: "DEMO — Segunda a sexta, das 9h às 18h.", category: "DEMO", status: "ACTIVE" },
  { id: "demo-faq-002", question: "Quais formas de pagamento são aceitas? — DEMO", answer: "DEMO — Informação ilustrativa; confirme as formas reais na homologação.", category: "DEMO", status: "DRAFT" },
];

const plans = [
  { id: "demo-plan-001", code: "demo-essencial", name: "Essencial — DEMO", monthlyPrice: "99.00", currency: "BRL", active: true, limits: { conversas: 500, membros: 3, canalWhatsApp: 1 } },
  { id: "demo-plan-002", code: "demo-profissional", name: "Profissional — DEMO", monthlyPrice: "199.00", currency: "BRL", active: true, limits: { conversas: 2000, membros: 10, canalWhatsApp: 1 } },
  { id: "demo-plan-003", code: "demo-escala", name: "Escala — DEMO", monthlyPrice: "399.00", currency: "BRL", active: true, limits: { conversas: 10000, membros: 30, canalWhatsApp: 3 } },
];

export function demoApiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return Promise.resolve().then(() => resolveDemoRequest<T>(path, init));
}

function resolveDemoRequest<T>(path: string, init: RequestInit): T {
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET") throw new DemoBackendRequiredError();

  const url = new URL(path, "https://preview.atendeia.local");
  const pathname = url.pathname;

  if (pathname === "/v1/dashboard/summary") {
    return response<T>({
      conversations: 18,
      messages: 124,
      waitingHuman: 2,
      members: 3,
      whatsapp: null,
      onboarding: {
        steps: { whatsapp: false, knowledge: true, ai: true, team: true },
        completed: 3,
        total: 4,
      },
    });
  }

  if (pathname === "/v1/conversations") {
    const status = url.searchParams.get("status");
    return response<T>(status ? conversations.filter((item) => item.status === status) : conversations);
  }

  const conversationId = pathname.match(/^\/v1\/conversations\/([^/]+)$/u)?.[1];
  if (conversationId) {
    const detail = conversationDetails.find((item) => item.id === conversationId);
    if (detail) return response<T>(detail);
  }

  if (pathname === "/v1/crm/contacts") return response<T>(contactPage(url));

  const contactId = pathname.match(/^\/v1\/crm\/contacts\/([^/]+)$/u)?.[1];
  if (contactId) {
    const contact = contacts.find((item) => item.id === contactId);
    if (contact) return response<T>(contactDetail(contact));
  }

  if (pathname === "/v1/knowledge/products") return response<T>(knowledgePage(products, url));
  if (pathname === "/v1/knowledge/services") return response<T>(knowledgePage(services, url));
  if (pathname === "/v1/knowledge/faqs") return response<T>(knowledgePage(faqs, url));
  if (pathname === "/v1/knowledge") {
    return response<T>({
      companyProfile: {
        description: "DEMO — Empresa fictícia usada exclusivamente para avaliação visual do AtendeIA.",
        address: "DEMO — Avenida da Prévia, 100, São Paulo - SP",
        phoneE164: "+5511900000099",
        email: "empresa@demo.invalid",
        policies: "DEMO — Estas políticas são ilustrativas e não representam condições comerciais reais.",
        usefulLinks: [{ label: "Site demonstrativo", url: "https://example.com" }],
      },
      businessHours: Array.from({ length: 7 }, (_, weekday) => ({
        id: `demo-hour-${weekday}`,
        weekday,
        opensAt: weekday > 0 && weekday < 6 ? "09:00" : null,
        closesAt: weekday > 0 && weekday < 6 ? "18:00" : null,
        isClosed: weekday === 0 || weekday === 6,
      })),
      businessHourExceptions: [
        { id: "demo-exception-001", date: "2026-09-07T00:00:00.000Z", label: "Feriado — DEMO", opensAt: null, closesAt: null, isClosed: true },
      ],
    });
  }

  if (pathname === "/v1/media/capabilities") return response<T>({ cloudinaryConfigured: false });
  if (pathname === "/v1/tenant/capabilities") {
    return response<T>({
      ai: { configured: false },
      whatsapp: { configured: false },
      billing: { STRIPE: false, MERCADO_PAGO: false, ASAAS: false },
    });
  }
  if (pathname === "/v1/whatsapp/connection") return response<T>(null);
  if (pathname === "/v1/ai/configuration") {
    return response<T>({
      enabled: true,
      tone: "profissional, cordial e objetivo — DEMO",
      minimumConfidence: "0.80",
      fallbackMessage: "DEMO — Não encontrei essa informação. Vou transferir para uma pessoa.",
      transferMessage: "DEMO — Um atendente continuará esta conversa.",
      maxContextMessages: 20,
    });
  }

  if (pathname === "/v1/team") {
    return response<T>([
      { id: "demo-member-001", role: "OWNER", active: true, mfaEnabled: false, createdAt: "2026-07-01T10:00:00.000Z", user: { id: "00000000-0000-4000-8000-00000000d001", fullName: "Administrador DEMO", email: "demo@preview.atendeia.local", status: "ACTIVE" } },
      { id: "demo-member-002", role: "ADMIN", active: true, mfaEnabled: true, createdAt: "2026-07-05T10:00:00.000Z", user: { id: "demo-user-002", fullName: "Gestora Demonstração — DEMO", email: "gestora@demo.invalid", status: "ACTIVE" } },
      { id: "demo-member-003", role: "AGENT", active: true, mfaEnabled: false, createdAt: "2026-07-08T10:00:00.000Z", user: { id: "demo-user-003", fullName: "Atendente Demonstração — DEMO", email: "atendente@demo.invalid", status: "ACTIVE" } },
    ]);
  }

  if (pathname === "/v1/billing/plans") return response<T>(plans);
  if (pathname === "/v1/billing/subscription") return response<T>(null);
  if (pathname === "/v1/tenant/profile") {
    return response<T>({ id: "00000000-0000-4000-8000-00000000d002", name: "Empresa Demonstração — DEMO", slug: "empresa-demonstracao-demo", timezone: "America/Sao_Paulo", status: "ACTIVE", createdAt: "2026-07-01T10:00:00.000Z" });
  }
  if (pathname === "/v1/auth/capabilities") return response<T>({ emailDelivery: false });
  if (pathname === "/v1/auth/sessions") {
    return response<T>([
      { id: "demo-session-001", deviceLabel: "Navegador da prévia — DEMO", createdAt: "2026-08-19T12:00:00.000Z", lastUsedAt: "2026-08-19T18:42:00.000Z", expiresAt: "2026-08-20T12:00:00.000Z", current: true },
      { id: "demo-session-002", deviceLabel: "Android demonstrativo — DEMO", createdAt: "2026-08-18T12:00:00.000Z", lastUsedAt: "2026-08-18T16:00:00.000Z", expiresAt: "2026-08-25T12:00:00.000Z", current: false },
    ]);
  }

  if (pathname === "/v1/super-admin/overview") return response<T>({ tenants: 4, users: 12, activeSubscriptions: 2, openConversations: 7, webhookFailures: 1 });
  if (pathname === "/v1/super-admin/tenants") {
    return response<T>([
      { id: "demo-tenant-001", name: "Empresa Alfa — DEMO", slug: "empresa-alfa-demo", status: "ACTIVE", createdAt: "2026-07-01T10:00:00.000Z", _count: { memberships: 3, conversations: 18 }, subscriptions: [{ status: "ACTIVE", provider: "STRIPE", plan: { code: "demo-profissional", name: "Profissional — DEMO" } }] },
      { id: "demo-tenant-002", name: "Empresa Beta — DEMO", slug: "empresa-beta-demo", status: "SUSPENDED", createdAt: "2026-07-10T10:00:00.000Z", _count: { memberships: 2, conversations: 6 }, subscriptions: [] },
    ]);
  }
  if (pathname === "/v1/super-admin/plans") return response<T>(plans);

  throw new DemoBackendRequiredError();
}

function contactPage(url: URL) {
  const archived = url.searchParams.get("archived") === "true";
  const search = url.searchParams.get("search")?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const source = url.searchParams.get("source");
  const tag = url.searchParams.get("tag")?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const items = contacts.filter((contact) => {
    if (Boolean(contact.archivedAt) !== archived) return false;
    if (source && contact.source !== source) return false;
    if (tag && !contact.tags.some((item) => item.toLocaleLowerCase("pt-BR") === tag)) return false;
    if (!search) return true;
    return [contact.displayName, contact.phoneE164, contact.email].filter(Boolean).some((value) => value?.toLocaleLowerCase("pt-BR").includes(search));
  });
  return { items, nextCursor: null };
}

function contactDetail(contact: (typeof contacts)[number]) {
  const relatedConversation = conversationDetails.filter((item) => item.contact.id === contact.id);
  return {
    ...contact,
    notes: contact.id === "00000000-0000-4000-8000-000000001001"
      ? [{ id: "demo-note-001", body: "DEMO — Cliente pediu retorno após avaliar o orçamento.", authorUserId: "00000000-0000-4000-8000-00000000d001", createdAt: "2026-08-19T16:00:00.000Z", author: { user: { fullName: "Administrador DEMO" } } }]
      : contact.id === "00000000-0000-4000-8000-000000001002"
        ? [
            { id: "demo-note-002", body: "DEMO — Atendimento prioritário apenas para avaliação visual.", authorUserId: "00000000-0000-4000-8000-00000000d001", createdAt: "2026-08-18T13:00:00.000Z", author: { user: { fullName: "Administrador DEMO" } } },
            { id: "demo-note-003", body: "DEMO — Nenhuma alteração será persistida.", authorUserId: "demo-user-002", createdAt: "2026-08-18T14:00:00.000Z", author: { user: { fullName: "Gestora Demonstração — DEMO" } } },
          ]
        : [],
    conversations: relatedConversation.map((item) => ({ id: item.id, status: item.status, openedAt: item.messages[0]?.createdAt ?? item.updatedAt, resolvedAt: item.status === "RESOLVED" ? item.updatedAt : null, updatedAt: item.updatedAt, messages: item.messages.map(({ body, sender, createdAt }) => ({ body, sender, createdAt })) })),
  };
}

function knowledgePage<T extends Record<string, unknown>>(source: T[], url: URL) {
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search")?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const items = source.filter((item) => {
    if (status && item.status !== status) return false;
    if (!search) return true;
    return Object.values(item).some((value) => typeof value === "string" && value.toLocaleLowerCase("pt-BR").includes(search));
  });
  return { items, nextCursor: null };
}

function response<T>(data: unknown): T {
  return structuredClone({ data }) as T;
}
