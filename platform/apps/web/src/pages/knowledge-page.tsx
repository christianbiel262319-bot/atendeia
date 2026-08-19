import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Clock3, Package, Plus, Trash2, Wrench } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
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
  kind: z.enum(["product", "service", "faq"]),
  title: z.string().trim().min(2, "Informe um título").max(1000),
  description: z.string().trim().min(2, "Informe a resposta ou descrição").max(5000),
  price: z.string().trim(),
  durationMinutes: z.string().trim(),
  status: z.enum(["DRAFT", "ACTIVE"]),
});
const hoursSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  opensAt: z.string(),
  closesAt: z.string(),
  isClosed: z.boolean(),
});

type ItemValues = z.infer<typeof itemSchema>;
type HoursValues = z.infer<typeof hoursSchema>;
type KnowledgeItem = { id: string; name?: string; question?: string; description?: string; answer?: string; price?: string | null; durationMinutes?: number | null; status: string };
type BusinessHour = { id: string; weekday: number; opensAt: string | null; closesAt: string | null; isClosed: boolean };
type Knowledge = { products: KnowledgeItem[]; services: KnowledgeItem[]; faqs: KnowledgeItem[]; businessHours: BusinessHour[] };

const tabs = [
  { key: "products", label: "Produtos", icon: Package },
  { key: "services", label: "Serviços", icon: Wrench },
  { key: "faqs", label: "Perguntas", icon: BookOpen },
  { key: "hours", label: "Horários", icon: Clock3 },
] as const;
type Tab = (typeof tabs)[number]["key"];

export function KnowledgePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFromSearch(searchParams);
  const [deleteTarget, setDeleteTarget] = useState<{ resource: "product" | "service" | "faq"; id: string; label: string } | null>(null);
  const queryClient = useQueryClient();
  const knowledge = useQuery({
    queryKey: ["knowledge"],
    queryFn: async () => (await apiRequest<{ data: Knowledge }>("/v1/knowledge", { authenticated: true })).data,
  });
  const items = tab === "hours" ? [] : (knowledge.data?.[tab] ?? []);
  const remove = useMutation({
    mutationFn: async (input: { resource: "product" | "service" | "faq"; id: string }) => apiRequest(`/v1/knowledge/${input.resource}/${input.id}`, { method: "DELETE", authenticated: true }),
    onSuccess: async () => {
      setDeleteTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["knowledge"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
    },
  });

  function selectTab(next: Tab): void {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("novo");
    nextParams.set("secao", next);
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <Page>
      <PageHeader eyebrow="BASE DE CONHECIMENTO" title="O que a IA pode afirmar" description="Somente itens ativos entram no contexto da IA. Rascunhos permanecem invisíveis para os clientes." />
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {tabs.map(({ key, label, icon: Icon }) => <button type="button" key={key} onClick={() => selectTab(key)} aria-pressed={tab === key} className={cn("inline-flex h-10 shrink-0 items-center gap-2 rounded-brand border px-4 text-xs font-semibold transition duration-fast", tab === key ? "border-brand-700 bg-brand-700 text-white" : "border-app-line bg-white text-slate-600 hover:border-brand-200 hover:bg-brand-50")}><Icon size={15} />{label}</button>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <section>
          {knowledge.isError ? <ErrorNotice message={knowledge.error.message} /> : null}
          {remove.isError ? <div className="mb-3"><ErrorNotice message={remove.error.message} /></div> : null}
          {knowledge.isLoading ? <LoadingState label="Carregando conhecimento" /> : tab === "hours" ? <HoursList hours={knowledge.data?.businessHours ?? []} /> : items.length === 0 ? <EmptyState title="Nenhum item cadastrado" description="Use o formulário ao lado para adicionar informação verdadeira da sua empresa." /> : (
            <div className="grid gap-3">
              {items.map((item) => (
                <Card key={item.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-900">{item.name ?? item.question}</h2><StatusPill value={item.status} /></div><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{item.description ?? item.answer}</p>{item.price ? <p className="mt-3 text-xs font-semibold text-emerald-700">R$ {Number(item.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p> : null}</div>
                    <Button variant="ghost" size="icon" aria-label={`Excluir ${item.name ?? item.question ?? "item"}`} disabled={remove.isPending} onClick={() => setDeleteTarget({ resource: tab === "products" ? "product" : tab === "services" ? "service" : "faq", id: item.id, label: item.name ?? item.question ?? "este item" })}><Trash2 size={16} /></Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
        {tab === "hours" ? <HoursForm /> : <KnowledgeForm key={tab} defaultKind={tab === "products" ? "product" : tab === "services" ? "service" : "faq"} shouldFocus={searchParams.has("novo")} />}
      </div>
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} titleId="delete-knowledge-title">
        <section className="w-full max-w-md rounded-[var(--radius-dialog)] border border-app-line bg-white p-6 shadow-dialog">
          <h2 className="text-lg font-semibold" id="delete-knowledge-title">Excluir conhecimento?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">“{deleteTarget?.label}” deixará de fazer parte do contexto da IA. Esta ação não pode ser desfeita.</p>
          <div className="mt-6 flex justify-end gap-3"><Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button><Button className="bg-red-700 shadow-none hover:bg-red-800" disabled={!deleteTarget || remove.isPending} onClick={() => deleteTarget && remove.mutate({ resource: deleteTarget.resource, id: deleteTarget.id })}>{remove.isPending ? "Excluindo…" : "Excluir"}</Button></div>
        </section>
      </Dialog>
    </Page>
  );
}

function KnowledgeForm({ defaultKind, shouldFocus }: { defaultKind: ItemValues["kind"]; shouldFocus: boolean }) {
  const queryClient = useQueryClient();
  const form = useForm<ItemValues>({ resolver: zodResolver(itemSchema), defaultValues: { kind: defaultKind, title: "", description: "", price: "", durationMinutes: "", status: "ACTIVE" } });
  const create = useMutation({
    mutationFn: async (values: ItemValues) => {
      const endpoint = values.kind === "product" ? "products" : values.kind === "service" ? "services" : "faqs";
      const body = values.kind === "faq"
        ? { question: values.title, answer: values.description, status: values.status, sortOrder: 0 }
        : {
            name: values.title,
            description: values.description,
            status: values.status,
            currency: "BRL",
            ...(values.price ? { price: Number(values.price.replace(",", ".")) } : {}),
            ...(values.kind === "service" && values.durationMinutes ? { durationMinutes: Number(values.durationMinutes) } : {}),
          };
      return apiRequest(`/v1/knowledge/${endpoint}`, { method: "POST", authenticated: true, body: JSON.stringify(body) });
    },
    onSuccess: async () => {
      form.reset({ kind: defaultKind, title: "", description: "", price: "", durationMinutes: "", status: "ACTIVE" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["knowledge"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
    },
  });
  const kind = useWatch({ control: form.control, name: "kind" });
  return (
    <Card className="h-fit p-5 sm:p-6">
      <div className="flex items-center gap-2"><Plus size={18} className="text-emerald-700" /><h2 className="font-semibold">Adicionar conhecimento</h2></div>
      <form className="mt-5 grid gap-4" onSubmit={(event) => void form.handleSubmit((values) => create.mutateAsync(values))(event)}>
        <input type="hidden" {...form.register("kind")} />
        <Field label={kind === "faq" ? "Pergunta" : "Nome"} error={form.formState.errors.title?.message}><Input autoFocus={shouldFocus} {...form.register("title")} /></Field>
        <Field label={kind === "faq" ? "Resposta exata" : "Descrição"} error={form.formState.errors.description?.message}><Textarea rows={5} {...form.register("description")} /></Field>
        {kind !== "faq" ? <Field label="Preço (opcional)"><Input inputMode="decimal" placeholder="0,00" {...form.register("price")} /></Field> : null}
        {kind === "service" ? <Field label="Duração em minutos (opcional)"><Input type="number" min="1" {...form.register("durationMinutes")} /></Field> : null}
        <Field label="Disponibilidade para a IA"><Select {...form.register("status")}><option value="ACTIVE">Ativo</option><option value="DRAFT">Rascunho</option></Select></Field>
        {create.error ? <ErrorNotice message={create.error.message} /> : null}
        {create.isSuccess ? <SuccessNotice message="Conhecimento adicionado e contexto da IA atualizado." /> : null}
        <Button type="submit" disabled={create.isPending}>{create.isPending ? "Salvando…" : "Adicionar"}</Button>
      </form>
    </Card>
  );
}

function HoursForm() {
  const queryClient = useQueryClient();
  const form = useForm<HoursValues>({ resolver: zodResolver(hoursSchema), defaultValues: { weekday: 1, opensAt: "09:00", closesAt: "18:00", isClosed: false } });
  const save = useMutation({
    mutationFn: async (values: HoursValues) => apiRequest("/v1/knowledge/business-hours", { method: "PUT", authenticated: true, body: JSON.stringify({ ...values, opensAt: values.isClosed ? null : values.opensAt, closesAt: values.isClosed ? null : values.closesAt }) }),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["knowledge"] }), queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] })]);
    },
  });
  const closed = useWatch({ control: form.control, name: "isClosed" });
  return <Card className="h-fit p-5 sm:p-6"><h2 className="font-semibold">Definir horário</h2><form className="mt-5 grid gap-4" onSubmit={(event) => void form.handleSubmit((values) => save.mutateAsync(values))(event)}><Field label="Dia"><Select {...form.register("weekday", { valueAsNumber: true })}><WeekdayOptions /></Select></Field><label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-brand-700" {...form.register("isClosed")} /> Fechado neste dia</label><div className="grid grid-cols-2 gap-3"><Field label="Abertura"><Input type="time" disabled={closed} {...form.register("opensAt")} /></Field><Field label="Fechamento"><Input type="time" disabled={closed} {...form.register("closesAt")} /></Field></div>{save.error ? <ErrorNotice message={save.error.message} /> : null}{save.isSuccess ? <SuccessNotice message="Horário salvo e disponibilizado para a IA." /> : null}<Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar horário"}</Button></form></Card>;
}

function HoursList({ hours }: { hours: BusinessHour[] }) {
  if (hours.length === 0) return <EmptyState title="Horários ainda não definidos" description="Cadastre cada dia para que a IA responda com segurança sobre funcionamento." />;
  const byDay = new Map(hours.map((hour) => [hour.weekday, hour]));
  return <Card className="divide-y divide-slate-100">{Array.from({ length: 7 }, (_, weekday) => { const hour = byDay.get(weekday); return <div key={weekday} className="flex items-center justify-between gap-3 px-5 py-4 text-sm"><strong>{weekdayName(weekday)}</strong><span className="text-slate-500">{!hour ? "Não definido" : hour.isClosed ? "Fechado" : `${hour.opensAt}–${hour.closesAt}`}</span></div>; })}</Card>;
}

function WeekdayOptions() {
  return <>{Array.from({ length: 7 }, (_, day) => <option key={day} value={day}>{weekdayName(day)}</option>)}</>;
}

function weekdayName(day: number): string {
  return ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"][day] ?? "Dia";
}

export function tabFromSearch(searchParams: URLSearchParams): Tab {
  const createMap: Record<string, Tab> = { produto: "products", servico: "services", faq: "faqs" };
  const section = searchParams.get("secao");
  const create = searchParams.get("novo");
  if (create && createMap[create]) return createMap[create];
  return tabs.some((item) => item.key === section) ? section as Tab : "products";
}
