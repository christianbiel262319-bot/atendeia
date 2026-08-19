import { zodResolver } from "@hookform/resolvers/zod";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  Clock3,
  FileText,
  Mail,
  MessageCircle,
  Plus,
  Search,
  Tags,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
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

const contactFormSchema = z.object({
  displayName: z.string().trim().min(1, "Informe o nome").max(160),
  phoneE164: z.string().trim().regex(/^\+[\d\s()-]{8,25}$/u, "Use o formato internacional, por exemplo +5511999999999"),
  email: z.union([z.literal(""), z.email("Informe um e-mail válido")]),
  tags: z.string().max(500).refine((value) => {
    const tags = parseTags(value);
    return tags.length <= 20 && tags.every((tag) => tag.length <= 40);
  }, "Use no máximo 20 tags de até 40 caracteres"),
});

const noteSchema = z.object({ body: z.string().trim().min(1, "Escreva a nota").max(5_000) });
type ContactValues = z.infer<typeof contactFormSchema>;
type NoteValues = z.infer<typeof noteSchema>;
type ContactSource = "WHATSAPP" | "MANUAL" | "IMPORT" | "API";
type ContactSummary = {
  id: string;
  displayName: string | null;
  phoneE164: string | null;
  email: string | null;
  tags: string[];
  source: ContactSource;
  lastInteractionAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { conversations: number; notes: number };
};
type ContactNote = {
  id: string;
  body: string;
  authorUserId: string;
  createdAt: string;
  author: { user: { fullName: string } };
};
type ContactConversation = {
  id: string;
  status: string;
  openedAt: string;
  resolvedAt: string | null;
  updatedAt: string;
  messages: Array<{ body: string; sender: string; createdAt: string }>;
};
type ContactDetail = ContactSummary & { notes: ContactNote[]; conversations: ContactConversation[] };
type ContactPageData = { items: ContactSummary[]; nextCursor: string | null };

export function ContactsPage() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [archived, setArchived] = useState(false);
  const [source, setSource] = useState<"" | ContactSource>("");
  const [tag, setTag] = useState("");
  const debouncedTag = useDebouncedValue(tag, 300);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const canCreate = ["OWNER", "ADMIN", "MANAGER", "AGENT"].includes(profile?.role ?? "");
  const createOpen = canCreate && searchParams.get("novo") === "contato";

  const contacts = useInfiniteQuery({
    queryKey: ["contacts", debouncedSearch, archived, source, debouncedTag],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ archived: String(archived), limit: "24" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (source) params.set("source", source);
      if (debouncedTag.trim()) params.set("tag", debouncedTag.trim());
      if (pageParam) params.set("cursor", pageParam);
      return (await apiRequest<{ data: ContactPageData }>(`/v1/crm/contacts?${params}`, { authenticated: true })).data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const items = useMemo(() => contacts.data?.pages.flatMap((page) => page.items) ?? [], [contacts.data]);

  function closeCreate(): void {
    const next = new URLSearchParams(searchParams);
    next.delete("novo");
    setSearchParams(next, { replace: true });
  }

  return (
    <Page>
      <PageHeader
        eyebrow="CRM"
        title="Contatos"
        description="Cadastros reais, histórico e notas da sua empresa. Contatos recebidos pelo WhatsApp continuam sincronizados automaticamente."
        action={canCreate ? <Button onClick={() => setSearchParams({ novo: "contato" })}><Plus size={16} />Novo contato</Button> : undefined}
      />

      <Card className="mb-5 grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_190px_180px_170px]">
        <label className="flex h-11 items-center gap-2 rounded-brand border border-app-line bg-white px-3 text-slate-400 shadow-sm">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Pesquisar contatos</span>
          <input className="w-full bg-transparent text-sm text-slate-800 outline-none" placeholder="Nome, telefone ou e-mail" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <Select aria-label="Filtrar por origem" value={source} onChange={(event) => setSource(event.target.value as "" | ContactSource)}>
          <option value="">Todas as origens</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="MANUAL">Manual</option>
          <option value="IMPORT">Importação</option>
          <option value="API">API</option>
        </Select>
        <Input aria-label="Filtrar por tag exata" placeholder="Tag exata" value={tag} onChange={(event) => setTag(event.target.value)} />
        <label className="flex min-h-11 items-center gap-3 rounded-brand border border-app-line bg-white px-3 text-sm text-slate-600 shadow-sm">
          <input type="checkbox" className="size-4 accent-brand-700" checked={archived} onChange={(event) => setArchived(event.target.checked)} />
          Ver arquivados
        </label>
      </Card>

      {contacts.isError ? <ErrorNotice message={contacts.error.message} /> : null}
      {contacts.isLoading ? <LoadingState label="Carregando contatos" /> : null}
      {!contacts.isLoading && !contacts.isError && items.length === 0 ? (
        <EmptyState
          title={archived ? "Nenhum contato arquivado" : "Nenhum contato encontrado"}
          description={debouncedSearch || source ? "Ajuste os filtros ou crie um novo contato." : "Cadastre um contato ou aguarde a primeira mensagem real pelo WhatsApp."}
          action={!archived && canCreate ? <Button size="sm" onClick={() => setSearchParams({ novo: "contato" })}><Plus size={15} />Criar contato</Button> : undefined}
        />
      ) : null}
      {items.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {items.map((contact) => <ContactCard key={contact.id} contact={contact} onOpen={() => setSelectedId(contact.id)} />)}
        </div>
      ) : null}
      {contacts.hasNextPage ? (
        <div className="mt-6 flex justify-center"><Button variant="outline" disabled={contacts.isFetchingNextPage} onClick={() => void contacts.fetchNextPage()}>{contacts.isFetchingNextPage ? "Carregando…" : "Carregar mais"}</Button></div>
      ) : null}

      {canCreate ? <ContactCreateDialog open={createOpen} onClose={closeCreate} onCreated={(id) => { closeCreate(); setSelectedId(id); }} /> : null}
      <ContactDetailDialog id={selectedId} onClose={() => setSelectedId(null)} />
    </Page>
  );
}

function ContactCard({ contact, onOpen }: { contact: ContactSummary; onOpen: () => void }) {
  return (
    <Card className="group p-0 transition duration-fast hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-popover">
      <button type="button" className="w-full p-5 text-left" onClick={onOpen}>
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><UserRound size={20} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3"><h2 className="truncate font-semibold text-slate-900">{contact.displayName ?? "Contato sem nome"}</h2><span className="shrink-0 text-[10px] font-semibold text-slate-400">{sourceLabel(contact.source)}</span></div>
            <p className="mt-1 text-xs text-slate-500">{contact.phoneE164 ?? "Telefone não informado"}</p>
            {contact.email ? <p className="mt-1 truncate text-xs text-slate-400">{contact.email}</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1"><MessageCircle size={12} />{contact._count.conversations}</span>
              {contact._count.notes > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700"><FileText size={11} />{contact._count.notes}</span> : null}
              {contact.tags.slice(0, 3).map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-violet-700"><Tags size={11} />{tag}</span>)}
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400"><Clock3 size={12} />{contact.lastInteractionAt ? `Última interação ${dateTimeLabel(contact.lastInteractionAt)}` : `Criado ${dateTimeLabel(contact.createdAt)}`}</p>
          </div>
        </div>
      </button>
    </Card>
  );
}

function ContactCreateDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const queryClient = useQueryClient();
  const form = useForm<ContactValues>({ resolver: zodResolver(contactFormSchema), defaultValues: { displayName: "", phoneE164: "+55", email: "", tags: "" } });
  const create = useMutation({
    mutationFn: async (values: ContactValues) => (await apiRequest<{ data: ContactSummary }>("/v1/crm/contacts", {
      method: "POST",
      authenticated: true,
      body: JSON.stringify({ displayName: values.displayName, phoneE164: values.phoneE164, email: values.email || null, tags: parseTags(values.tags) }),
    })).data,
    onSuccess: async (contact) => {
      form.reset({ displayName: "", phoneE164: "+55", email: "", tags: "" });
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      onCreated(contact.id);
    },
  });
  return (
    <Dialog open={open} onClose={onClose} titleId="create-contact-title">
      <section className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-[var(--radius-dialog)] border border-app-line bg-white p-6 shadow-dialog sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold" id="create-contact-title">Novo contato</h2><p className="mt-1 text-sm text-slate-500">O cadastro será salvo para a empresa ativa.</p></div><Button size="icon" variant="ghost" aria-label="Fechar" onClick={onClose}><X size={18} /></Button></div>
        <form className="mt-6 grid gap-4" onSubmit={(event) => void form.handleSubmit((values) => create.mutateAsync(values))(event)}>
          <Field label="Nome" error={form.formState.errors.displayName?.message}><Input autoFocus autoComplete="name" {...form.register("displayName")} /></Field>
          <Field label="Telefone internacional" error={form.formState.errors.phoneE164?.message}><Input inputMode="tel" autoComplete="tel" placeholder="+5511999999999" {...form.register("phoneE164")} /></Field>
          <Field label="E-mail (opcional)" error={form.formState.errors.email?.message}><Input type="email" autoComplete="email" {...form.register("email")} /></Field>
          <Field label="Tags separadas por vírgula" error={form.formState.errors.tags?.message}><Input placeholder="Cliente, Retorno" {...form.register("tags")} /></Field>
          {create.error ? <ErrorNotice message={create.error.message} /> : null}
          <div className="flex justify-end gap-3"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={create.isPending}>{create.isPending ? "Salvando…" : "Criar contato"}</Button></div>
        </form>
      </section>
    </Dialog>
  );
}

function ContactDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { profile } = useAuth();
  const canOperate = ["OWNER", "ADMIN", "MANAGER", "AGENT"].includes(profile?.role ?? "");
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [noteDeleteTarget, setNoteDeleteTarget] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["contact", id],
    queryFn: async () => (await apiRequest<{ data: ContactDetail }>(`/v1/crm/contacts/${id}`, { authenticated: true })).data,
    enabled: Boolean(id),
  });
  const contact = detail.data;
  const form = useForm<ContactValues>({ resolver: zodResolver(contactFormSchema), defaultValues: { displayName: "", phoneE164: "+55", email: "", tags: "" } });
  const noteForm = useForm<NoteValues>({ resolver: zodResolver(noteSchema), defaultValues: { body: "" } });

  useEffect(() => {
    if (!contact) return;
    form.reset({ displayName: contact.displayName ?? "", phoneE164: contact.phoneE164 ?? "+55", email: contact.email ?? "", tags: contact.tags.join(", ") });
  }, [contact, form]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["contact", id] }),
      queryClient.invalidateQueries({ queryKey: ["contacts"] }),
    ]);
  };
  const save = useMutation({
    mutationFn: async (values: ContactValues) => apiRequest(`/v1/crm/contacts/${id}`, {
      method: "PATCH",
      authenticated: true,
      body: JSON.stringify({ displayName: values.displayName, ...(contact?.source !== "WHATSAPP" ? { phoneE164: values.phoneE164 } : {}), email: values.email || null, tags: parseTags(values.tags) }),
    }),
    onSuccess: async () => { await refresh(); setEditing(false); setFeedback("Contato atualizado com sucesso."); },
  });
  const addNote = useMutation({
    mutationFn: async (values: NoteValues) => apiRequest(`/v1/crm/contacts/${id}/notes`, { method: "POST", authenticated: true, body: JSON.stringify(values) }),
    onSuccess: async () => { noteForm.reset(); await refresh(); setFeedback("Nota adicionada ao histórico."); },
  });
  const removeNote = useMutation({
    mutationFn: async (noteId: string) => apiRequest(`/v1/crm/contacts/${id}/notes/${noteId}`, { method: "DELETE", authenticated: true }),
    onSuccess: async () => { setNoteDeleteTarget(null); await refresh(); setFeedback("Nota excluída."); },
  });
  const archive = useMutation({
    mutationFn: async () => apiRequest(`/v1/crm/contacts/${id}`, { method: "DELETE", authenticated: true }),
    onSuccess: async () => { setConfirmArchive(false); await refresh(); setFeedback("Contato arquivado."); },
  });
  const restore = useMutation({
    mutationFn: async () => apiRequest(`/v1/crm/contacts/${id}/restore`, { method: "POST", authenticated: true }),
    onSuccess: async () => { await refresh(); setFeedback("Contato restaurado."); },
  });
  const mutationError = save.error ?? addNote.error ?? removeNote.error ?? archive.error ?? restore.error;

  function close(): void {
    setEditing(false);
    setFeedback(null);
    setConfirmArchive(false);
    setNoteDeleteTarget(null);
    onClose();
  }

  return (
    <Dialog open={Boolean(id)} onClose={close} titleId="contact-detail-title">
      <section className="max-h-[calc(100vh-1.5rem)] w-[min(980px,calc(100vw-1.5rem))] overflow-y-auto rounded-[var(--radius-dialog)] border border-app-line bg-app-canvas shadow-dialog">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-app-line bg-white/95 p-5 backdrop-blur sm:p-6">
          <div><span className="text-[10px] font-bold tracking-wider text-slate-400">FICHA DO CONTATO</span><h2 className="mt-1 text-xl font-semibold" id="contact-detail-title">{contact?.displayName ?? "Contato"}</h2>{contact ? <p className="mt-1 text-xs text-slate-500">{sourceLabel(contact.source)} · criado {dateTimeLabel(contact.createdAt)}</p> : null}</div>
          <Button size="icon" variant="ghost" aria-label="Fechar detalhes" onClick={close}><X size={19} /></Button>
        </header>
        <div className="p-4 sm:p-6">
          {detail.isLoading ? <LoadingState label="Carregando contato" /> : null}
          {detail.isError ? <ErrorNotice message={detail.error.message} /> : null}
          {mutationError ? <div className="mb-4"><ErrorNotice message={mutationError.message} /></div> : null}
          {feedback ? <div className="mb-4"><SuccessNotice message={feedback} /></div> : null}
          {contact ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.78fr)]">
              <div className="grid gap-5">
                <Card className="p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Dados do contato</h3>{canOperate ? <Button size="sm" variant="ghost" onClick={() => setEditing((value) => !value)}>{editing ? "Cancelar edição" : "Editar"}</Button> : null}</div>
                  {editing ? (
                    <form className="mt-5 grid gap-4" onSubmit={(event) => void form.handleSubmit((values) => save.mutateAsync(values))(event)}>
                      <Field label="Nome" error={form.formState.errors.displayName?.message}><Input {...form.register("displayName")} /></Field>
                      <Field label="Telefone" error={form.formState.errors.phoneE164?.message} hint={contact.source === "WHATSAPP" ? "Sincronizado pela Meta e protegido contra alteração manual." : undefined}><Input disabled={contact.source === "WHATSAPP"} {...form.register("phoneE164")} /></Field>
                      <Field label="E-mail" error={form.formState.errors.email?.message}><Input type="email" {...form.register("email")} /></Field>
                      <Field label="Tags separadas por vírgula" error={form.formState.errors.tags?.message}><Input {...form.register("tags")} /></Field>
                      <Button className="w-fit" type="submit" size="sm" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar alterações"}</Button>
                    </form>
                  ) : (
                    <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                      <ContactField icon={MessageCircle} label="Telefone" value={contact.phoneE164 ?? "Não informado"} />
                      <ContactField icon={Mail} label="E-mail" value={contact.email ?? "Não informado"} />
                      <ContactField icon={Clock3} label="Última interação" value={contact.lastInteractionAt ? dateTimeLabel(contact.lastInteractionAt) : "Ainda sem interação"} />
                      <ContactField icon={Tags} label="Tags" value={contact.tags.length ? contact.tags.join(", ") : "Nenhuma tag"} />
                    </dl>
                  )}
                </Card>

                <Card className="p-5 sm:p-6">
                  <h3 className="font-semibold">Histórico de conversas</h3>
                  {contact.conversations.length === 0 ? <p className="mt-4 text-sm leading-6 text-slate-500">Este contato ainda não possui conversas.</p> : (
                    <div className="mt-4 grid gap-3">{contact.conversations.map((conversation) => <div key={conversation.id} className="rounded-brand border border-app-line bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><StatusPill value={conversation.status} /><span className="text-[11px] text-slate-400">{dateTimeLabel(conversation.updatedAt)}</span></div><p className="mt-3 line-clamp-2 text-sm text-slate-600">{conversation.messages[0]?.body ?? "Conversa sem mensagens registradas"}</p></div>)}</div>
                  )}
                </Card>
              </div>

              <div className="grid content-start gap-5">
                <Card className="p-5 sm:p-6">
                  <h3 className="font-semibold">Notas internas</h3><p className="mt-1 text-xs leading-5 text-slate-500">Visíveis somente para a equipe desta empresa.</p>
                  {canOperate ? <form className="mt-4 grid gap-3" onSubmit={(event) => void noteForm.handleSubmit((values) => addNote.mutateAsync(values))(event)}><Field label="Nova nota" error={noteForm.formState.errors.body?.message}><Textarea rows={3} placeholder="Registre contexto útil para a equipe" {...noteForm.register("body")} /></Field><Button className="w-fit" size="sm" type="submit" disabled={addNote.isPending}>{addNote.isPending ? "Adicionando…" : "Adicionar nota"}</Button></form> : null}
                  <div className="mt-5 grid gap-3 border-t border-app-line pt-5">
                    {contact.notes.length === 0 ? <p className="text-sm text-slate-500">Nenhuma nota registrada.</p> : contact.notes.map((note) => {
                      const canRemove = canOperate && (note.authorUserId === profile?.user.id || ["OWNER", "ADMIN", "MANAGER"].includes(profile?.role ?? ""));
                      return <article key={note.id} className="rounded-brand bg-amber-50/70 p-4"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.body}</p><div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-500"><span>{note.author.user.fullName} · {dateTimeLabel(note.createdAt)}</span>{canRemove ? noteDeleteTarget === note.id ? <span className="flex items-center gap-1"><Button size="sm" variant="ghost" onClick={() => setNoteDeleteTarget(null)}>Cancelar</Button><Button size="sm" className="bg-red-700 shadow-none hover:bg-red-800" disabled={removeNote.isPending} onClick={() => removeNote.mutate(note.id)}>Excluir</Button></span> : <Button size="icon" variant="ghost" aria-label="Excluir nota" onClick={() => setNoteDeleteTarget(note.id)}><Trash2 size={14} /></Button> : null}</div></article>;
                    })}
                  </div>
                </Card>

                {canOperate ? <Card className="p-5">
                  <h3 className="text-sm font-semibold">Arquivamento</h3><p className="mt-2 text-xs leading-5 text-slate-500">O histórico é preservado. Contatos com atendimento ativo precisam ser encerrados antes.</p>
                  {contact.archivedAt ? <Button className="mt-4 w-full" variant="outline" disabled={restore.isPending} onClick={() => restore.mutate()}><ArchiveRestore size={16} />{restore.isPending ? "Restaurando…" : "Restaurar contato"}</Button> : confirmArchive ? <div className="mt-4 grid gap-2"><p className="text-xs font-medium text-red-700">Confirma o arquivamento?</p><div className="flex gap-2"><Button className="flex-1" size="sm" variant="outline" onClick={() => setConfirmArchive(false)}>Cancelar</Button><Button className="flex-1 bg-red-700 shadow-none hover:bg-red-800" size="sm" disabled={archive.isPending} onClick={() => archive.mutate()}>{archive.isPending ? "Arquivando…" : "Confirmar"}</Button></div></div> : <Button className="mt-4 w-full" variant="outline" onClick={() => setConfirmArchive(true)}><Archive size={16} />Arquivar contato</Button>}
                </Card> : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </Dialog>
  );
}

function ContactField({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-brand bg-slate-100 text-slate-500"><Icon size={15} /></span><div><dt className="text-[10px] font-bold tracking-wide text-slate-400">{label.toUpperCase()}</dt><dd className="mt-1 break-words text-slate-700">{value}</dd></div></div>;
}

function parseTags(value: string): string[] {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function sourceLabel(source: ContactSource): string {
  return { WHATSAPP: "WhatsApp", MANUAL: "Manual", IMPORT: "Importação", API: "API" }[source];
}

function dateTimeLabel(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}
