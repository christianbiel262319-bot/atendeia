import { zodResolver } from "@hookform/resolvers/zod";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Building2,
  CalendarDays,
  Clock3,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/auth/auth-provider";
import { EmptyState, ErrorNotice, LoadingState, Page, PageHeader, StatusPill, SuccessNotice } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

const itemSchema = z.object({
  title: z.string().trim().min(2, "Informe um título").max(1_000),
  description: z.string().trim().min(2, "Informe a resposta ou descrição").max(5_000),
  category: z.string().trim().max(80),
  price: z.string().trim().refine((value) => {
    if (!value) return true;
    const normalized = value.replace(",", ".");
    return /^\d+(?:\.\d{1,2})?$/u.test(normalized) && Number(normalized) <= 99_999_999;
  }, "Informe um preço válido com até duas casas decimais"),
  durationMinutes: z.string().trim().refine((value) => !value || (/^\d+$/u.test(value) && Number(value) >= 1 && Number(value) <= 100_000), "Informe uma duração válida"),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  available: z.boolean(),
  imageAssetId: z.string().nullable(),
});
const hoursSchema = z.object({ weekday: z.number().int().min(0).max(6), opensAt: z.string(), closesAt: z.string(), isClosed: z.boolean() });
const exceptionSchema = z.object({ date: z.string().min(1, "Informe a data"), label: z.string().max(120), opensAt: z.string(), closesAt: z.string(), isClosed: z.boolean() });
const companySchema = z.object({
  description: z.string().max(10_000),
  address: z.string().max(1_000),
  phoneE164: z.union([z.literal(""), z.string().regex(/^\+[1-9]\d{7,14}$/u, "Use o formato internacional")]),
  email: z.union([z.literal(""), z.email("Informe um e-mail válido")]),
  policies: z.string().max(10_000),
  usefulLinks: z.string().max(10_000).refine((value) => {
    try { parseLinks(value); return true; } catch { return false; }
  }, "Use uma linha por link no formato Nome | https://endereco.com"),
});

type ItemValues = z.infer<typeof itemSchema>;
type HoursValues = z.infer<typeof hoursSchema>;
type ExceptionValues = z.infer<typeof exceptionSchema>;
type CompanyValues = z.infer<typeof companySchema>;
type ItemKind = "product" | "service" | "faq";
type MediaAsset = { id: string; secureUrl: string; width: number | null; height: number | null };
type KnowledgeItem = {
  id: string;
  name?: string;
  question?: string;
  description?: string;
  answer?: string;
  category: string | null;
  price?: string | null;
  durationMinutes?: number | null;
  available?: boolean;
  imageAssetId?: string | null;
  imageAsset?: MediaAsset | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
};
type BusinessHour = { id: string; weekday: number; opensAt: string | null; closesAt: string | null; isClosed: boolean };
type BusinessHourException = { id: string; date: string; label: string | null; opensAt: string | null; closesAt: string | null; isClosed: boolean };
type UsefulLink = { label: string; url: string };
type CompanyProfile = { description: string | null; address: string | null; phoneE164: string | null; email: string | null; policies: string | null; usefulLinks: UsefulLink[] };
type KnowledgeOverview = { businessHours: BusinessHour[]; businessHourExceptions: BusinessHourException[]; companyProfile: CompanyProfile | null };
type KnowledgePageData = { items: KnowledgeItem[]; nextCursor: string | null };

const tabs = [
  { key: "products", label: "Produtos", icon: Package },
  { key: "services", label: "Serviços", icon: Wrench },
  { key: "faqs", label: "FAQs", icon: BookOpen },
  { key: "company", label: "Empresa", icon: Building2 },
  { key: "hours", label: "Horários", icon: Clock3 },
] as const;
type Tab = (typeof tabs)[number]["key"];

export function KnowledgePage() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFromSearch(searchParams);
  const canManage = ["OWNER", "ADMIN", "MANAGER"].includes(profile?.role ?? "");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<KnowledgeItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ resource: ItemKind; id: string; label: string } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const itemTab = tab === "products" || tab === "services" || tab === "faqs";
  const resourcePath = tab === "services" ? "services" : tab === "faqs" ? "faqs" : "products";

  const list = useInfiniteQuery({
    queryKey: ["knowledge-items", resourcePath, debouncedSearch, status],
    initialPageParam: undefined as string | undefined,
    enabled: itemTab,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "30" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status) params.set("status", status);
      if (pageParam) params.set("cursor", pageParam);
      return (await apiRequest<{ data: KnowledgePageData }>(`/v1/knowledge/${resourcePath}?${params}`, { authenticated: true })).data;
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const items = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  const overview = useQuery({
    queryKey: ["knowledge-overview"],
    queryFn: async () => (await apiRequest<{ data: KnowledgeOverview }>("/v1/knowledge", { authenticated: true })).data,
    enabled: !itemTab,
  });
  const remove = useMutation({
    mutationFn: async (input: { resource: ItemKind; id: string }) => apiRequest(`/v1/knowledge/${input.resource}/${input.id}`, { method: "DELETE", authenticated: true }),
    onSuccess: async () => {
      setDeleteTarget(null);
      setEditing(null);
      setFeedback("Item excluído e removido do contexto da IA.");
      await invalidateKnowledge(queryClient);
    },
  });

  function selectTab(next: Tab): void {
    const params = new URLSearchParams();
    params.set("secao", next);
    setSearchParams(params, { replace: true });
    setEditing(null);
    setFeedback(null);
    setSearch("");
    setStatus("");
  }

  function kindForTab(): ItemKind {
    return tab === "services" ? "service" : tab === "faqs" ? "faq" : "product";
  }

  return (
    <Page>
      <PageHeader eyebrow="BASE DE CONHECIMENTO" title="O que a IA pode afirmar" description="Somente informações persistidas e ativas entram no contexto. Disponibilidade, horários especiais e políticas ficam explícitos para evitar respostas inventadas." />
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {tabs.map(({ key, label, icon: Icon }) => <button type="button" key={key} onClick={() => selectTab(key)} aria-pressed={tab === key} className={cn("inline-flex h-10 shrink-0 items-center gap-2 rounded-brand border px-4 text-xs font-semibold transition duration-fast", tab === key ? "border-brand-700 bg-brand-700 text-white" : "border-app-line bg-white text-slate-600 hover:border-brand-200 hover:bg-brand-50")}><Icon size={15} />{label}</button>)}
      </div>

      {feedback ? <div className="mb-4"><SuccessNotice message={feedback} /></div> : null}
      {itemTab ? (
        <div className={cn("grid gap-5", canManage && "xl:grid-cols-[minmax(0,1fr)_400px]")}>
          <section>
            <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_180px]">
              <label className="flex h-11 items-center gap-2 rounded-brand border border-app-line bg-white px-3 text-slate-400 shadow-sm"><Search size={16} /><span className="sr-only">Pesquisar conhecimento</span><input className="w-full bg-transparent text-sm text-slate-800 outline-none" placeholder="Pesquisar título, descrição ou categoria" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
              <Select aria-label="Filtrar por status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos os status</option><option value="ACTIVE">Ativos</option><option value="DRAFT">Rascunhos</option><option value="ARCHIVED">Arquivados</option></Select>
            </Card>
            {list.isError ? <ErrorNotice message={list.error.message} /> : null}
            {remove.isError ? <div className="mb-3"><ErrorNotice message={remove.error.message} /></div> : null}
            {list.isLoading ? <LoadingState label="Carregando conhecimento" /> : null}
            {!list.isLoading && !list.isError && items.length === 0 ? <EmptyState title="Nenhum item encontrado" description={debouncedSearch || status ? "Ajuste os filtros para localizar outro item." : canManage ? "Use o formulário para adicionar informação verdadeira da sua empresa." : "Um administrador ainda não cadastrou informações nesta seção."} /> : null}
            <div className="grid gap-3">{items.map((item) => <KnowledgeCard key={item.id} item={item} canManage={canManage} onEdit={() => { setEditing(item); setFeedback(null); }} onDelete={() => setDeleteTarget({ resource: kindForTab(), id: item.id, label: item.name ?? item.question ?? "este item" })} />)}</div>
            {list.hasNextPage ? <div className="mt-5 flex justify-center"><Button variant="outline" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>{list.isFetchingNextPage ? "Carregando…" : "Carregar mais"}</Button></div> : null}
          </section>
          {canManage ? <KnowledgeEditor key={`${kindForTab()}-${editing?.id ?? "new"}`} kind={kindForTab()} item={editing} shouldFocus={searchParams.has("novo")} onCancel={() => setEditing(null)} onSaved={async (message) => { setEditing(null); setFeedback(message); await invalidateKnowledge(queryClient); }} /> : null}
        </div>
      ) : tab === "company" ? (
        overview.isLoading ? <LoadingState /> : overview.isError ? <ErrorNotice message={overview.error.message} /> : <CompanyWorkspace profile={overview.data?.companyProfile ?? null} canManage={canManage} onSaved={async () => { setFeedback("Informações da empresa atualizadas para a IA."); await invalidateKnowledge(queryClient); }} />
      ) : (
        overview.isLoading ? <LoadingState /> : overview.isError ? <ErrorNotice message={overview.error.message} /> : <HoursWorkspace hours={overview.data?.businessHours ?? []} exceptions={overview.data?.businessHourExceptions ?? []} canManage={canManage} onSaved={async (message) => { setFeedback(message); await invalidateKnowledge(queryClient); }} />
      )}

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} titleId="delete-knowledge-title">
        <section className="w-full max-w-md rounded-[var(--radius-dialog)] border border-app-line bg-white p-6 shadow-dialog"><h2 className="text-lg font-semibold" id="delete-knowledge-title">Excluir conhecimento?</h2><p className="mt-2 text-sm leading-6 text-slate-500">“{deleteTarget?.label}” deixará de fazer parte do contexto da IA. Esta ação não pode ser desfeita.</p><div className="mt-6 flex justify-end gap-3"><Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button><Button className="bg-red-700 shadow-none hover:bg-red-800" disabled={!deleteTarget || remove.isPending} onClick={() => deleteTarget && remove.mutate({ resource: deleteTarget.resource, id: deleteTarget.id })}>{remove.isPending ? "Excluindo…" : "Excluir"}</Button></div></section>
      </Dialog>
    </Page>
  );
}

function KnowledgeCard({ item, canManage, onEdit, onDelete }: { item: KnowledgeItem; canManage: boolean; onEdit: () => void; onDelete: () => void }) {
  return <Card className="overflow-hidden p-0"><div className="flex items-stretch">{item.imageAsset ? <img className="hidden w-28 shrink-0 object-cover sm:block" src={item.imageAsset.secureUrl} alt="" /> : null}<div className="min-w-0 flex-1 p-5"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-900">{item.name ?? item.question}</h2><StatusPill value={item.status} />{item.available === false ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700">INDISPONÍVEL</span> : null}</div>{item.category ? <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-violet-600">{item.category}</p> : null}<p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{item.description ?? item.answer}</p><div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-brand-700">{item.price ? <span>{money(item.price)}</span> : null}{item.durationMinutes ? <span>{item.durationMinutes} min</span> : null}</div></div>{canManage ? <div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" aria-label={`Editar ${item.name ?? item.question ?? "item"}`} onClick={onEdit}><Pencil size={16} /></Button><Button variant="ghost" size="icon" aria-label={`Excluir ${item.name ?? item.question ?? "item"}`} onClick={onDelete}><Trash2 size={16} /></Button></div> : null}</div></div></div></Card>;
}

function KnowledgeEditor({ kind, item, shouldFocus, onCancel, onSaved }: { kind: ItemKind; item: KnowledgeItem | null; shouldFocus: boolean; onCancel: () => void; onSaved: (message: string) => Promise<void> }) {
  const form = useForm<ItemValues>({ resolver: zodResolver(itemSchema), defaultValues: {
    title: item?.name ?? item?.question ?? "",
    description: item?.description ?? item?.answer ?? "",
    category: item?.category ?? "",
    price: item?.price ? String(item.price) : "",
    durationMinutes: item?.durationMinutes ? String(item.durationMinutes) : "",
    status: item?.status ?? "ACTIVE",
    available: item?.available ?? true,
    imageAssetId: item?.imageAssetId ?? null,
  } });
  const save = useMutation({
    mutationFn: async (values: ItemValues) => {
      const endpoint = kind === "product" ? "products" : kind === "service" ? "services" : "faqs";
      const body = kind === "faq" ? {
        question: values.title,
        answer: values.description,
        category: values.category || null,
        status: values.status,
        sortOrder: 0,
      } : {
        name: values.title,
        description: values.description,
        category: values.category || null,
        status: values.status,
        currency: "BRL",
        available: values.available,
        price: values.price ? Number(values.price.replace(",", ".")) : null,
        ...(kind === "service" ? { durationMinutes: values.durationMinutes ? Number(values.durationMinutes) : null } : {}),
        ...(kind === "product" ? { imageAssetId: values.imageAssetId } : {}),
      };
      return apiRequest(`/v1/knowledge/${endpoint}${item ? `/${item.id}` : ""}`, { method: item ? "PATCH" : "POST", authenticated: true, body: JSON.stringify(body) });
    },
    onSuccess: async () => {
      if (!item) form.reset({ title: "", description: "", category: "", price: "", durationMinutes: "", status: "ACTIVE", available: true, imageAssetId: null });
      await onSaved(item ? "Conhecimento atualizado e contexto da IA renovado." : "Conhecimento adicionado e disponível para a IA conforme o status.");
    },
  });
  const imageAssetId = useWatch({ control: form.control, name: "imageAssetId" });
  const [uploadedImage, setUploadedImage] = useState<MediaAsset | null>(item?.imageAsset ?? null);
  return <Card className="h-fit p-5 sm:p-6 xl:sticky xl:top-24"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2">{item ? <Pencil size={18} className="text-brand-700" /> : <Plus size={18} className="text-brand-700" />}<h2 className="font-semibold">{item ? "Editar conhecimento" : "Adicionar conhecimento"}</h2></div>{item ? <Button size="icon" variant="ghost" aria-label="Cancelar edição" onClick={onCancel}><X size={17} /></Button> : null}</div><form className="mt-5 grid gap-4" onSubmit={(event) => void form.handleSubmit((values) => save.mutate(values))(event)}><Field label={kind === "faq" ? "Pergunta" : "Nome"} error={form.formState.errors.title?.message}><Input autoFocus={shouldFocus || Boolean(item)} {...form.register("title")} /></Field><Field label={kind === "faq" ? "Resposta exata" : "Descrição"} error={form.formState.errors.description?.message}><Textarea rows={5} {...form.register("description")} /></Field><Field label="Categoria (opcional)" error={form.formState.errors.category?.message}><Input placeholder="Ex.: Entrega" {...form.register("category")} /></Field>{kind !== "faq" ? <Field label="Preço (opcional)"><Input inputMode="decimal" placeholder="0,00" {...form.register("price")} /></Field> : null}{kind === "service" ? <Field label="Duração em minutos (opcional)"><Input type="number" min="1" {...form.register("durationMinutes")} /></Field> : null}{kind === "product" ? <ProductImageField current={uploadedImage} selectedId={imageAssetId} onSelected={(asset) => { setUploadedImage(asset); form.setValue("imageAssetId", asset?.id ?? null, { shouldDirty: true }); }} /> : null}{kind !== "faq" ? <label className="flex min-h-11 items-center gap-3 rounded-brand border border-app-line bg-slate-50 px-3 text-sm text-slate-700"><input type="checkbox" className="size-4 accent-brand-700" {...form.register("available")} />Disponível para venda ou contratação</label> : null}<Field label="Disponibilidade para a IA"><Select {...form.register("status")}><option value="ACTIVE">Ativo</option><option value="DRAFT">Rascunho</option><option value="ARCHIVED">Arquivado</option></Select></Field>{save.error ? <ErrorNotice message={save.error.message} /> : null}<Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando…" : item ? "Salvar alterações" : "Adicionar"}</Button></form></Card>;
}

function ProductImageField({ current, selectedId, onSelected }: { current: MediaAsset | null; selectedId: string | null; onSelected: (asset: MediaAsset | null) => void }) {
  const capabilities = useQuery({ queryKey: ["media-capabilities"], queryFn: async () => (await apiRequest<{ data: { cloudinaryConfigured: boolean } }>("/v1/media/capabilities", { authenticated: true })).data });
  const upload = useMutation({
    mutationFn: uploadProductImage,
    onSuccess: onSelected,
  });
  const configured = capabilities.data?.cloudinaryConfigured === true;
  return <div className="grid gap-2"><span className="text-sm font-medium text-slate-700">Imagem (opcional)</span>{current && selectedId ? <div className="relative overflow-hidden rounded-brand border border-app-line bg-slate-50"><img className="h-36 w-full object-cover" src={current.secureUrl} alt="Prévia do produto" /><Button className="absolute right-2 top-2 bg-white/95" size="sm" variant="outline" onClick={() => onSelected(null)}>Remover</Button></div> : null}{capabilities.isLoading ? <div className="h-11 animate-pulse rounded-brand bg-slate-100" /> : configured ? <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-brand border border-dashed border-brand-300 bg-brand-50 px-4 text-sm font-semibold text-brand-800 transition hover:bg-brand-100"><Upload size={16} />{upload.isPending ? "Enviando…" : "Enviar imagem"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={upload.isPending} onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate(file); event.target.value = ""; }} /></label> : <div className="rounded-brand border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><strong>Configuração necessária:</strong> configure o Cloudinary no servidor para enviar imagens. O restante do produto pode ser salvo normalmente.</div>}{capabilities.isError ? <ErrorNotice message={capabilities.error.message} /> : null}{upload.error ? <ErrorNotice message={upload.error.message} /> : null}</div>;
}

async function uploadProductImage(file: File): Promise<MediaAsset> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use uma imagem JPG, PNG ou WebP");
  if (file.size > 10 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 10 MB");
  const signature = (await apiRequest<{ data: { cloudName: string; apiKey: string; timestamp: number; folder: string; signature: string } }>("/v1/media/upload-signature", { authenticated: true })).data;
  const body = new FormData();
  body.set("file", file);
  body.set("api_key", signature.apiKey);
  body.set("timestamp", String(signature.timestamp));
  body.set("folder", signature.folder);
  body.set("signature", signature.signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/image/upload`, { method: "POST", body });
  const uploaded = await response.json() as { public_id?: string; secure_url?: string; resource_type?: string; format?: string; bytes?: number; width?: number; height?: number; version?: number; signature?: string; error?: { message?: string } };
  if (!response.ok || !uploaded.public_id || !uploaded.secure_url || !uploaded.version || !uploaded.signature) throw new Error(uploaded.error?.message ?? "Não foi possível enviar a imagem");
  return (await apiRequest<{ data: MediaAsset }>("/v1/media", { method: "POST", authenticated: true, body: JSON.stringify({ publicId: uploaded.public_id, secureUrl: uploaded.secure_url, resourceType: uploaded.resource_type ?? "image", format: uploaded.format, bytes: uploaded.bytes, width: uploaded.width, height: uploaded.height, version: uploaded.version, signature: uploaded.signature }) })).data;
}

function CompanyWorkspace({ profile, canManage, onSaved }: { profile: CompanyProfile | null; canManage: boolean; onSaved: () => Promise<void> }) {
  if (!canManage) return <CompanyReadOnly profile={profile} />;
  return <CompanyEditor profile={profile} onSaved={onSaved} />;
}

function CompanyReadOnly({ profile }: { profile: CompanyProfile | null }) {
  if (!profile) return <EmptyState title="Informações da empresa não cadastradas" description="Um administrador precisa cadastrar os dados que a IA pode usar." />;
  return <Card className="grid gap-5 p-6 md:grid-cols-2"><ReadOnlyBlock title="Descrição" value={profile.description} /><ReadOnlyBlock title="Endereço" value={profile.address} /><ReadOnlyBlock title="Contato" value={[profile.phoneE164, profile.email].filter(Boolean).join(" · ") || null} /><ReadOnlyBlock title="Políticas" value={profile.policies} /><div className="md:col-span-2"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Links úteis</h3>{profile.usefulLinks.length ? <ul className="mt-3 grid gap-2">{profile.usefulLinks.map((link) => <li key={link.url}><a className="text-sm font-semibold text-brand-700 hover:underline" href={link.url} target="_blank" rel="noreferrer">{link.label}</a></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">Não informado</p>}</div></Card>;
}

function CompanyEditor({ profile, onSaved }: { profile: CompanyProfile | null; onSaved: () => Promise<void> }) {
  const form = useForm<CompanyValues>({ resolver: zodResolver(companySchema), defaultValues: companyDefaults(profile) });
  useEffect(() => form.reset(companyDefaults(profile)), [form, profile]);
  const save = useMutation({
    mutationFn: async (values: CompanyValues) => apiRequest("/v1/knowledge/company-profile", { method: "PUT", authenticated: true, body: JSON.stringify({ description: values.description || null, address: values.address || null, phoneE164: values.phoneE164 || null, email: values.email || null, policies: values.policies || null, usefulLinks: parseLinks(values.usefulLinks) }) }),
    onSuccess: onSaved,
  });
  return <Card className="mx-auto max-w-4xl p-5 sm:p-7"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-brand bg-brand-50 text-brand-700"><Building2 size={20} /></span><div><h2 className="font-semibold">Informações oficiais da empresa</h2><p className="mt-1 text-sm leading-6 text-slate-500">A IA poderá usar somente os campos preenchidos quando forem relevantes para a pergunta.</p></div></div><form className="mt-6 grid gap-5" onSubmit={(event) => void form.handleSubmit((values) => save.mutate(values))(event)}><Field label="Descrição da empresa" error={form.formState.errors.description?.message}><Textarea rows={4} placeholder="O que a empresa faz e para quem" {...form.register("description")} /></Field><Field label="Endereço" error={form.formState.errors.address?.message}><Textarea rows={3} placeholder="Endereço completo e orientações relevantes" {...form.register("address")} /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="Telefone" error={form.formState.errors.phoneE164?.message}><Input placeholder="+5511999999999" {...form.register("phoneE164")} /></Field><Field label="E-mail" error={form.formState.errors.email?.message}><Input type="email" {...form.register("email")} /></Field></div><Field label="Políticas" error={form.formState.errors.policies?.message}><Textarea rows={5} placeholder="Trocas, devoluções, cancelamentos e garantias" {...form.register("policies")} /></Field><Field label="Links úteis" hint="Um por linha no formato Nome | https://endereco.com" error={form.formState.errors.usefulLinks?.message}><Textarea rows={4} placeholder={"Site | https://empresa.com\nInstagram | https://instagram.com/empresa"} {...form.register("usefulLinks")} /></Field>{save.error ? <ErrorNotice message={save.error.message} /> : null}<Button className="w-fit" type="submit" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar informações"}</Button></form></Card>;
}

function HoursWorkspace({ hours, exceptions, canManage, onSaved }: { hours: BusinessHour[]; exceptions: BusinessHourException[]; canManage: boolean; onSaved: (message: string) => Promise<void> }) {
  const [editingException, setEditingException] = useState<BusinessHourException | null>(null);
  return <div className={cn("grid gap-5", canManage && "xl:grid-cols-[minmax(0,1fr)_400px]")}><div className="grid content-start gap-5"><HoursList hours={hours} /><ExceptionList exceptions={exceptions} canManage={canManage} onEdit={setEditingException} onSaved={onSaved} /></div>{canManage ? <HoursEditors hours={hours} editingException={editingException} onCancelException={() => setEditingException(null)} onSaved={async (message) => { setEditingException(null); await onSaved(message); }} /> : null}</div>;
}

function HoursEditors({ hours, editingException, onCancelException, onSaved }: { hours: BusinessHour[]; editingException: BusinessHourException | null; onCancelException: () => void; onSaved: (message: string) => Promise<void> }) {
  const form = useForm<HoursValues>({ resolver: zodResolver(hoursSchema), defaultValues: { weekday: 1, opensAt: "09:00", closesAt: "18:00", isClosed: false } });
  const exceptionForm = useForm<ExceptionValues>({ resolver: zodResolver(exceptionSchema), defaultValues: { date: "", label: "", opensAt: "09:00", closesAt: "18:00", isClosed: true } });
  const saveHour = useMutation({ mutationFn: async (values: HoursValues) => apiRequest("/v1/knowledge/business-hours", { method: "PUT", authenticated: true, body: JSON.stringify({ ...values, opensAt: values.isClosed ? null : values.opensAt, closesAt: values.isClosed ? null : values.closesAt }) }), onSuccess: async () => onSaved("Horário semanal atualizado para a IA.") });
  const saveException = useMutation({ mutationFn: async (values: ExceptionValues) => apiRequest("/v1/knowledge/business-hours/exceptions", { method: "PUT", authenticated: true, body: JSON.stringify({ ...values, label: values.label || null, opensAt: values.isClosed ? null : values.opensAt, closesAt: values.isClosed ? null : values.closesAt }) }), onSuccess: async () => { exceptionForm.reset({ date: "", label: "", opensAt: "09:00", closesAt: "18:00", isClosed: true }); await onSaved("Exceção de horário salva para a IA."); } });
  const closed = useWatch({ control: form.control, name: "isClosed" });
  const exceptionClosed = useWatch({ control: exceptionForm.control, name: "isClosed" });
  useEffect(() => {
    if (!editingException) return;
    exceptionForm.reset({ date: editingException.date.slice(0, 10), label: editingException.label ?? "", opensAt: editingException.opensAt ?? "09:00", closesAt: editingException.closesAt ?? "18:00", isClosed: editingException.isClosed });
  }, [editingException, exceptionForm]);
  function loadDay(day: number): void { const hour = hours.find((item) => item.weekday === day); form.reset({ weekday: day, opensAt: hour?.opensAt ?? "09:00", closesAt: hour?.closesAt ?? "18:00", isClosed: hour?.isClosed ?? false }); }
  return <div className="grid content-start gap-5"><Card className="p-5 sm:p-6"><h2 className="font-semibold">Horário semanal</h2><form className="mt-5 grid gap-4" onSubmit={(event) => void form.handleSubmit((values) => saveHour.mutate(values))(event)}><Field label="Dia"><Select {...form.register("weekday", { valueAsNumber: true })} onChange={(event) => loadDay(Number(event.target.value))}><WeekdayOptions /></Select></Field><label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-brand-700" {...form.register("isClosed")} />Fechado neste dia</label><div className="grid grid-cols-2 gap-3"><Field label="Abertura"><Input type="time" disabled={closed} {...form.register("opensAt")} /></Field><Field label="Fechamento"><Input type="time" disabled={closed} {...form.register("closesAt")} /></Field></div>{saveHour.error ? <ErrorNotice message={saveHour.error.message} /> : null}<Button type="submit" disabled={saveHour.isPending}>{saveHour.isPending ? "Salvando…" : "Salvar dia"}</Button></form></Card><Card className="p-5 sm:p-6"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><CalendarDays size={18} className="text-violet-600" /><h2 className="font-semibold">{editingException ? "Editar exceção" : "Feriado ou exceção"}</h2></div>{editingException ? <Button size="icon" variant="ghost" aria-label="Cancelar edição" onClick={() => { onCancelException(); exceptionForm.reset({ date: "", label: "", opensAt: "09:00", closesAt: "18:00", isClosed: true }); }}><X size={16} /></Button> : null}</div><form className="mt-5 grid gap-4" onSubmit={(event) => void exceptionForm.handleSubmit((values) => saveException.mutate(values))(event)}><Field label="Data" error={exceptionForm.formState.errors.date?.message}><Input type="date" {...exceptionForm.register("date")} /></Field><Field label="Descrição (opcional)"><Input placeholder="Ex.: Feriado municipal" {...exceptionForm.register("label")} /></Field><label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-brand-700" {...exceptionForm.register("isClosed")} />Fechado nesta data</label><div className="grid grid-cols-2 gap-3"><Field label="Abertura"><Input type="time" disabled={exceptionClosed} {...exceptionForm.register("opensAt")} /></Field><Field label="Fechamento"><Input type="time" disabled={exceptionClosed} {...exceptionForm.register("closesAt")} /></Field></div>{saveException.error ? <ErrorNotice message={saveException.error.message} /> : null}<Button type="submit" disabled={saveException.isPending}>{saveException.isPending ? "Salvando…" : editingException ? "Salvar alterações" : "Salvar exceção"}</Button></form></Card></div>;
}

function HoursList({ hours }: { hours: BusinessHour[] }) {
  const byDay = new Map(hours.map((hour) => [hour.weekday, hour]));
  return <Card><div className="border-b border-app-line px-5 py-4"><h2 className="font-semibold">Funcionamento semanal</h2></div><div className="divide-y divide-slate-100">{Array.from({ length: 7 }, (_, weekday) => { const hour = byDay.get(weekday); return <div key={weekday} className="flex items-center justify-between gap-3 px-5 py-4 text-sm"><strong>{weekdayName(weekday)}</strong><span className="text-slate-500">{!hour ? "Não definido" : hour.isClosed ? "Fechado" : `${hour.opensAt}–${hour.closesAt}`}</span></div>; })}</div></Card>;
}

function ExceptionList({ exceptions, canManage, onEdit, onSaved }: { exceptions: BusinessHourException[]; canManage: boolean; onEdit: (exception: BusinessHourException) => void; onSaved: (message: string) => Promise<void> }) {
  const [target, setTarget] = useState<string | null>(null);
  const remove = useMutation({ mutationFn: async (id: string) => apiRequest(`/v1/knowledge/business-hours/exceptions/${id}`, { method: "DELETE", authenticated: true }), onSuccess: async () => { setTarget(null); await onSaved("Exceção removida do calendário da IA."); } });
  return <Card><div className="border-b border-app-line px-5 py-4"><h2 className="font-semibold">Exceções cadastradas</h2><p className="mt-1 text-xs text-slate-500">Feriados e mudanças pontuais têm prioridade sobre a semana padrão.</p></div>{exceptions.length === 0 ? <p className="p-5 text-sm text-slate-500">Nenhuma exceção cadastrada.</p> : <div className="divide-y divide-slate-100">{exceptions.map((exception) => <div className="flex items-center gap-3 px-5 py-4" key={exception.id}><span className="grid size-10 shrink-0 place-items-center rounded-brand bg-violet-50 text-violet-700"><CalendarDays size={17} /></span><div className="min-w-0 flex-1"><strong className="block text-sm">{dateLabel(exception.date)}</strong><span className="mt-1 block text-xs text-slate-500">{exception.label ? `${exception.label} · ` : ""}{exception.isClosed ? "Fechado" : `${exception.opensAt}–${exception.closesAt}`}</span></div>{canManage ? target === exception.id ? <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setTarget(null)}>Cancelar</Button><Button size="sm" className="bg-red-700 shadow-none hover:bg-red-800" disabled={remove.isPending} onClick={() => remove.mutate(exception.id)}>Excluir</Button></div> : <div className="flex gap-1"><Button size="icon" variant="ghost" aria-label="Editar exceção" onClick={() => onEdit(exception)}><Pencil size={15} /></Button><Button size="icon" variant="ghost" aria-label="Excluir exceção" onClick={() => setTarget(exception.id)}><Trash2 size={15} /></Button></div> : null}</div>)}</div>}{remove.error ? <div className="m-4"><ErrorNotice message={remove.error.message} /></div> : null}</Card>;
}

function ReadOnlyBlock({ title, value }: { title: string; value: string | null }) { return <div><h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{value ?? "Não informado"}</p></div>; }
function WeekdayOptions() { return <>{Array.from({ length: 7 }, (_, day) => <option key={day} value={day}>{weekdayName(day)}</option>)}</>; }
function weekdayName(day: number): string { return ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"][day] ?? "Dia"; }
function money(value: string): string { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value)); }
function dateLabel(value: string): string { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(value)); }
function companyDefaults(profile: CompanyProfile | null): CompanyValues { return { description: profile?.description ?? "", address: profile?.address ?? "", phoneE164: profile?.phoneE164 ?? "", email: profile?.email ?? "", policies: profile?.policies ?? "", usefulLinks: profile?.usefulLinks.map((link) => `${link.label} | ${link.url}`).join("\n") ?? "" }; }

function parseLinks(value: string): UsefulLink[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const separator = line.indexOf("|");
    if (separator < 1) throw new Error("Use o formato Nome | https://endereco.com em cada link");
    const label = line.slice(0, separator).trim();
    const url = line.slice(separator + 1).trim();
    try {
      const protocol = new URL(url).protocol;
      if (protocol !== "https:" && protocol !== "http:") throw new Error("invalid protocol");
    } catch { throw new Error(`O endereço de “${label}” precisa usar HTTP ou HTTPS`); }
    return { label, url };
  });
}

async function invalidateKnowledge(queryClient: ReturnType<typeof useQueryClient>): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["knowledge-items"] }),
    queryClient.invalidateQueries({ queryKey: ["knowledge-overview"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
  ]);
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(value), delay); return () => window.clearTimeout(timer); }, [delay, value]);
  return debounced;
}

export function tabFromSearch(searchParams: URLSearchParams): Tab {
  const createMap: Record<string, Tab> = { produto: "products", servico: "services", faq: "faqs" };
  const section = searchParams.get("secao");
  const create = searchParams.get("novo");
  if (create && createMap[create]) return createMap[create];
  return tabs.some((item) => item.key === section) ? section as Tab : "products";
}
