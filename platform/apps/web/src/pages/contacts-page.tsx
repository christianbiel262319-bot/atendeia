import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Search, Tags, UserRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { EmptyState, ErrorNotice, Page, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

const contactSchema = z.object({
  displayName: z.string().trim().max(160),
  email: z.union([z.literal(""), z.email("Informe um e-mail válido")]),
  tags: z.string().max(500),
});
type ContactValues = z.infer<typeof contactSchema>;
type Contact = { id: string; displayName: string | null; phoneE164: string | null; email: string | null; tags: string[]; updatedAt: string; _count: { conversations: number } };

export function ContactsPage() {
  const [search, setSearch] = useState("");
  const contacts = useQuery({
    queryKey: ["contacts", search],
    queryFn: async () => (await apiRequest<{ data: Contact[] }>(`/v1/crm/contacts${search ? `?search=${encodeURIComponent(search)}` : ""}`, { authenticated: true })).data,
  });
  return (
    <Page>
      <PageHeader eyebrow="CRM" title="Contatos" description="Os contatos são criados somente a partir de interações reais recebidas pelo WhatsApp." action={<label className="flex h-11 w-full max-w-72 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm"><Search size={16} /><input className="w-full bg-transparent text-sm text-slate-800 outline-none" placeholder="Nome, telefone ou e-mail" value={search} onChange={(event) => setSearch(event.target.value)} /></label>} />
      {contacts.isError ? <ErrorNotice message={contacts.error.message} /> : null}
      {!contacts.isLoading && contacts.data?.length === 0 ? <EmptyState title="Nenhum contato encontrado" description="Quando um cliente escrever no WhatsApp, seu cadastro aparecerá automaticamente aqui." /> : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {contacts.data?.map((contact) => <ContactCard key={contact.id} contact={contact} />)}
        </div>
      )}
    </Page>
  );
}

function ContactCard({ contact }: { contact: Contact }) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const form = useForm<ContactValues>({ resolver: zodResolver(contactSchema), defaultValues: { displayName: contact.displayName ?? "", email: contact.email ?? "", tags: contact.tags.join(", ") } });
  const save = useMutation({
    mutationFn: async (values: ContactValues) => apiRequest(`/v1/crm/contacts/${contact.id}`, { method: "PATCH", authenticated: true, body: JSON.stringify({ displayName: values.displayName || null, email: values.email || null, tags: values.tags.split(",").map((tag) => tag.trim()).filter(Boolean) }) }),
    onSuccess: async () => { setEditing(false); await queryClient.invalidateQueries({ queryKey: ["contacts"] }); },
  });
  return <Card className="p-5"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><UserRound size={20} /></span><div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{contact.displayName ?? "Contato sem nome"}</h2><p className="mt-1 text-xs text-slate-500">{contact.phoneE164 ?? "Telefone não informado"}</p><div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500"><span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1"><MessageCircle size={12} />{contact._count.conversations} conversa(s)</span>{contact.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-violet-700"><Tags size={11} />{tag}</span>)}</div></div><Button variant="ghost" size="sm" onClick={() => setEditing((value) => !value)}>{editing ? "Fechar" : "Editar"}</Button></div>{editing ? <form className="mt-5 grid gap-4 border-t border-slate-100 pt-5" onSubmit={(event) => void form.handleSubmit((values) => save.mutateAsync(values))(event)}><Field label="Nome" error={form.formState.errors.displayName?.message}><Input {...form.register("displayName")} /></Field><Field label="E-mail" error={form.formState.errors.email?.message}><Input type="email" {...form.register("email")} /></Field><Field label="Tags separadas por vírgula" error={form.formState.errors.tags?.message}><Input {...form.register("tags")} /></Field>{save.error ? <ErrorNotice message={save.error.message} /> : null}<Button type="submit" size="sm" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar contato"}</Button></form> : null}</Card>;
}
