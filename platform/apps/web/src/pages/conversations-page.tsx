import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Inbox, MessageCircle, Send, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { EmptyState, ErrorNotice, Page, PageHeader, StatusPill } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, getRealtimeCredential, restoreApiSession } from "@/lib/api";
import { cn } from "@/lib/utils";

const messageSchema = z.object({ body: z.string().trim().min(1, "Digite uma mensagem").max(3000) });
type MessageValues = z.infer<typeof messageSchema>;
type ConversationRow = {
  id: string;
  status: string;
  needsHumanReason: string | null;
  updatedAt: string;
  contact: { id: string; displayName: string | null; phoneE164: string | null; tags: string[] };
  messages: Array<{ body: string; sender: string; createdAt: string; status: string }>;
};
type ConversationDetail = Omit<ConversationRow, "messages"> & {
  messages: Array<{ id: string; body: string; sender: string; direction: string; status: string; createdAt: string; aiConfidence: string | null }>;
};

export function ConversationsPage() {
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const conversations = useQuery({
    queryKey: ["conversations", status],
    queryFn: async () => (await apiRequest<{ data: ConversationRow[] }>(`/v1/conversations${status ? `?status=${status}` : ""}`, { authenticated: true })).data,
    refetchInterval: 15_000,
  });
  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const connect = async (renewSession: boolean): Promise<void> => {
      try {
        if (renewSession) await restoreApiSession();
        const credential = getRealtimeCredential();
        if (!credential || disposed) return;
        socket = new WebSocket(`${protocol}//${window.location.host}/realtime`, ["atendeia.realtime", credential]);
        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(String(event.data)) as { type?: string; conversationId?: string };
            if (message.type === "conversation.updated") {
              void queryClient.invalidateQueries({ queryKey: ["conversations"] });
              if (message.conversationId) void queryClient.invalidateQueries({ queryKey: ["conversation", message.conversationId] });
            }
          } catch {
            // Eventos desconhecidos não alteram o estado local.
          }
        };
        socket.onclose = () => {
          if (!disposed) retryTimer = window.setTimeout(() => void connect(true), 2_000);
        };
      } catch {
        if (!disposed) retryTimer = window.setTimeout(() => void connect(true), 5_000);
      }
    };
    void connect(false);
    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [queryClient]);
  const activeSelectedId = selectedId && conversations.data?.some((item) => item.id === selectedId)
    ? selectedId
    : conversations.data?.[0]?.id ?? null;
  const detail = useQuery({
    queryKey: ["conversation", activeSelectedId],
    enabled: Boolean(activeSelectedId),
    queryFn: async () => (await apiRequest<{ data: ConversationDetail }>(`/v1/conversations/${activeSelectedId}`, { authenticated: true })).data,
    refetchInterval: 8_000,
  });
  const form = useForm<MessageValues>({ resolver: zodResolver(messageSchema), defaultValues: { body: "" } });
  const send = useMutation({
    mutationFn: async (values: MessageValues) => apiRequest(`/v1/conversations/${activeSelectedId}/messages`, { method: "POST", authenticated: true, body: JSON.stringify(values) }),
    onSuccess: async () => {
      form.reset();
      await refreshConversationQueries(queryClient, activeSelectedId);
    },
  });
  const resolve = useMutation({
    mutationFn: async () => apiRequest(`/v1/conversations/${activeSelectedId}/resolve`, { method: "POST", authenticated: true }),
    onSuccess: async () => refreshConversationQueries(queryClient, activeSelectedId),
  });

  return (
    <Page width="max-w-[1500px]">
      <PageHeader eyebrow="CAIXA DE ENTRADA" title="Atendimentos" description="Acompanhe a IA, assuma conversas transferidas e responda pelo número oficial da empresa." action={<Select className="w-48" aria-label="Filtrar por status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos os status</option><option value="WAITING_HUMAN">Aguardando humano</option><option value="WITH_HUMAN">Com humano</option><option value="OPEN">Abertos</option><option value="RESOLVED">Resolvidos</option></Select>} />
      {conversations.isError ? <ErrorNotice message={conversations.error.message} /> : null}
      {!conversations.isLoading && conversations.data?.length === 0 ? <EmptyState title="Nenhuma conversa ainda" description="As mensagens recebidas pelo webhook oficial da Meta aparecerão aqui." /> : (
        <div className="grid min-h-[650px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[360px_1fr]">
          <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
            <div className="flex h-14 items-center gap-2 border-b border-slate-100 px-4 text-sm font-semibold"><Inbox size={17} className="text-emerald-700" /> Conversas</div>
            <div className="max-h-[300px] overflow-y-auto lg:max-h-[594px]">
              {conversations.data?.map((conversation) => (
                <button key={conversation.id} className={cn("w-full border-b border-slate-100 p-4 text-left transition hover:bg-slate-50", activeSelectedId === conversation.id && "bg-emerald-50/70")} onClick={() => setSelectedId(conversation.id)}>
                  <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500"><UserRound size={18} /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{conversation.contact.displayName ?? conversation.contact.phoneE164 ?? "Cliente"}</strong><span className="shrink-0 text-[10px] text-slate-400">{shortTime(conversation.updatedAt)}</span></div><p className="mt-1 truncate text-xs text-slate-500">{conversation.messages[0]?.body ?? "Conversa sem mensagens"}</p><div className="mt-2"><StatusPill value={conversation.status} /></div></div></div>
                </button>
              ))}
            </div>
          </aside>
          <section className="flex min-h-[520px] flex-col">
            {detail.data ? <>
              <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3"><div><strong className="block text-sm">{detail.data.contact.displayName ?? detail.data.contact.phoneE164 ?? "Cliente"}</strong><span className="mt-1 block text-xs text-slate-400">{detail.data.contact.phoneE164}</span></div><div className="flex items-center gap-2"><StatusPill value={detail.data.status} />{detail.data.status !== "RESOLVED" ? <Button variant="outline" size="sm" disabled={resolve.isPending} onClick={() => resolve.mutate()}><CheckCircle2 size={15} /> Resolver</Button> : null}</div></header>
              {resolve.error ? <div className="border-b border-red-100 p-3"><ErrorNotice message={resolve.error.message} /></div> : null}
              {detail.data.needsHumanReason ? <div className="border-b border-amber-100 bg-amber-50 px-5 py-3 text-xs text-amber-800"><strong>Transferência:</strong> {detail.data.needsHumanReason}</div> : null}
              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4 sm:p-6">
                {detail.data.messages.map((message) => <MessageBubble key={message.id} message={message} />)}
              </div>
              <form className="border-t border-slate-100 bg-white p-4" onSubmit={(event) => void form.handleSubmit((values) => send.mutate(values))(event)}><div className="flex items-end gap-3"><Textarea className="min-h-12 flex-1" rows={2} placeholder="Escreva uma resposta humana…" {...form.register("body")} /><Button type="submit" size="icon" aria-label="Enviar mensagem" disabled={send.isPending}><Send size={17} /></Button></div>{send.error ? <div className="mt-3"><ErrorNotice message={send.error.message} /></div> : null}</form>
            </> : <div className="grid flex-1 place-items-center text-center text-slate-400"><div><MessageCircle className="mx-auto" size={32} /><p className="mt-3 text-sm">Selecione uma conversa</p></div></div>}
          </section>
        </div>
      )}
    </Page>
  );
}

function MessageBubble({ message }: { message: ConversationDetail["messages"][number] }) {
  const outbound = message.direction === "OUTBOUND";
  return <div className={cn("flex", outbound ? "justify-end" : "justify-start")}><div className={cn("max-w-[82%] rounded-2xl px-4 py-3 shadow-sm", outbound ? "rounded-br-md bg-emerald-800 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800")}><div className="mb-1 flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider opacity-60"><span>{message.sender === "AI" ? "IA" : message.sender === "HUMAN" ? "Equipe" : "Cliente"}</span><span>{shortTime(message.createdAt)}</span></div><p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p></div></div>;
}

async function refreshConversationQueries(queryClient: ReturnType<typeof useQueryClient>, selectedId: string | null) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["conversations"] }),
    queryClient.invalidateQueries({ queryKey: ["conversation", selectedId] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
  ]);
}

function shortTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
