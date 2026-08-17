import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CheckCircle2, KeyRound, MessageCircle, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ErrorNotice, Page, PageHeader, StatusPill } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";

const whatsappSchema = z.object({
  phoneNumberId: z.string().trim().min(5, "Informe o ID do telefone"),
  businessAccountId: z.string().trim().min(5, "Informe o ID da conta comercial"),
  accessToken: z.string().trim().min(20, "Informe um token válido"),
});

const aiSchema = z.object({
  enabled: z.boolean(),
  tone: z.string().trim().min(3).max(120),
  minimumConfidence: z.number().min(0.5).max(1),
  fallbackMessage: z.string().trim().max(1000),
  transferMessage: z.string().trim().max(1000),
  maxContextMessages: z.number().int().min(1).max(50),
});

type WhatsAppValues = z.infer<typeof whatsappSchema>;
type AiValues = z.infer<typeof aiSchema>;
type Connection = { id: string; phoneNumberId: string; businessAccountId: string; displayPhoneNumber: string | null; status: string; connectedAt: string | null };
type AiConfiguration = { enabled: boolean; tone: string; minimumConfidence: string | number; fallbackMessage: string | null; transferMessage: string | null; maxContextMessages: number };

export function AutomationPage() {
  const queryClient = useQueryClient();
  const connection = useQuery({
    queryKey: ["whatsapp-connection"],
    queryFn: async () => (await apiRequest<{ data: Connection | null }>("/v1/whatsapp/connection", { authenticated: true })).data,
  });
  const ai = useQuery({
    queryKey: ["ai-configuration"],
    queryFn: async () => (await apiRequest<{ data: AiConfiguration | null }>("/v1/ai/configuration", { authenticated: true })).data,
  });
  const whatsappForm = useForm<WhatsAppValues>({ resolver: zodResolver(whatsappSchema) });
  const aiForm = useForm<AiValues>({
    resolver: zodResolver(aiSchema),
    defaultValues: {
      enabled: false,
      tone: "profissional e cordial",
      minimumConfidence: 0.75,
      fallbackMessage: "",
      transferMessage: "",
      maxContextMessages: 20,
    },
  });

  useEffect(() => {
    if (!ai.data) return;
    aiForm.reset({
      enabled: ai.data.enabled,
      tone: ai.data.tone,
      minimumConfidence: Number(ai.data.minimumConfidence),
      fallbackMessage: ai.data.fallbackMessage ?? "",
      transferMessage: ai.data.transferMessage ?? "",
      maxContextMessages: ai.data.maxContextMessages,
    });
  }, [ai.data, aiForm]);

  const connect = useMutation({
    mutationFn: async (values: WhatsAppValues) => apiRequest("/v1/whatsapp/connection", { method: "POST", authenticated: true, body: JSON.stringify(values) }),
    onSuccess: async () => {
      whatsappForm.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["whatsapp-connection"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
    },
  });
  const saveAi = useMutation({
    mutationFn: async (values: AiValues) => apiRequest("/v1/ai/configuration", {
      method: "PUT",
      authenticated: true,
      body: JSON.stringify({
        ...values,
        fallbackMessage: values.fallbackMessage || null,
        transferMessage: values.transferMessage || null,
      }),
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ai-configuration"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
    },
  });

  return (
    <Page>
      <PageHeader eyebrow="AUTOMAÇÃO" title="WhatsApp e IA" description="Conecte o canal oficial da Meta e defina exatamente quando a IA pode responder." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><MessageCircle size={20} /></span><div><h2 className="font-semibold">WhatsApp Cloud API</h2><p className="mt-1 text-xs leading-5 text-slate-500">O token é validado pela Meta e armazenado criptografado.</p></div></div>
            {connection.data ? <StatusPill value={connection.data.status} /> : null}
          </div>
          {connection.data ? (
            <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><CheckCircle2 size={17} /> Canal conectado</div>
              <dl className="mt-3 grid gap-2 text-xs text-emerald-900/70 sm:grid-cols-2"><div><dt className="font-medium">Número</dt><dd className="mt-1">{connection.data.displayPhoneNumber ?? "Confirmado pela Meta"}</dd></div><div><dt className="font-medium">Phone Number ID</dt><dd className="mt-1 break-all">{connection.data.phoneNumberId}</dd></div></dl>
            </div>
          ) : (
            <form className="mt-6 grid gap-4" onSubmit={(event) => void whatsappForm.handleSubmit((values) => connect.mutateAsync(values))(event)}>
              <Field label="Phone Number ID" error={whatsappForm.formState.errors.phoneNumberId?.message}><Input autoComplete="off" {...whatsappForm.register("phoneNumberId")} /></Field>
              <Field label="WhatsApp Business Account ID" error={whatsappForm.formState.errors.businessAccountId?.message}><Input autoComplete="off" {...whatsappForm.register("businessAccountId")} /></Field>
              <Field label="Token permanente da Meta" error={whatsappForm.formState.errors.accessToken?.message}><Input type="password" autoComplete="off" {...whatsappForm.register("accessToken")} /></Field>
              {connect.error ? <ErrorNotice message={connect.error.message} /> : null}
              <Button type="submit" disabled={connect.isPending}><KeyRound size={16} />{connect.isPending ? "Validando…" : "Validar e conectar"}</Button>
            </form>
          )}
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600"><strong className="text-slate-800">Webhook:</strong> configure na Meta o endereço <code className="break-all text-emerald-800">{window.location.origin}/v1/webhooks/whatsapp</code>.</div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-700"><Bot size={20} /></span><div><h2 className="font-semibold">Contrato da IA</h2><p className="mt-1 text-xs leading-5 text-slate-500">Sem contexto suficiente, a conversa é transferida para uma pessoa.</p></div></div>
          <form className="mt-6 grid gap-4" onSubmit={(event) => void aiForm.handleSubmit((values) => saveAi.mutateAsync(values))(event)}>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 p-4"><span><strong className="block text-sm">Ativar respostas automáticas</strong><span className="mt-1 block text-xs text-slate-500">Ative somente depois de cadastrar conhecimento.</span></span><input className="size-5 accent-emerald-700" type="checkbox" {...aiForm.register("enabled")} /></label>
            <Field label="Tom de voz" error={aiForm.formState.errors.tone?.message}><Input {...aiForm.register("tone")} /></Field>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Confiança mínima" error={aiForm.formState.errors.minimumConfidence?.message}><Input type="number" min="0.5" max="1" step="0.05" {...aiForm.register("minimumConfidence", { valueAsNumber: true })} /></Field><Field label="Mensagens de contexto" error={aiForm.formState.errors.maxContextMessages?.message}><Input type="number" min="1" max="50" {...aiForm.register("maxContextMessages", { valueAsNumber: true })} /></Field></div>
            <Field label="Mensagem sem contexto"><Textarea rows={3} placeholder="Opcional: mensagem segura de fallback" {...aiForm.register("fallbackMessage")} /></Field>
            <Field label="Mensagem de transferência"><Textarea rows={3} placeholder="Opcional: aviso de transferência para humano" {...aiForm.register("transferMessage")} /></Field>
            {saveAi.error ? <ErrorNotice message={saveAi.error.message} /> : null}
            {saveAi.isSuccess ? <p className="flex items-center gap-2 text-sm text-emerald-700"><ShieldCheck size={17} /> Configuração salva e auditada.</p> : null}
            <Button type="submit" disabled={saveAi.isPending}>{saveAi.isPending ? "Salvando…" : "Salvar configuração"}</Button>
          </form>
        </Card>
      </div>
    </Page>
  );
}
