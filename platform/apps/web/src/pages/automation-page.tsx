import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CheckCircle2, ChevronDown, CircleAlert, KeyRound, MessageCircle, ShieldCheck, SlidersHorizontal, UserRoundCheck } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/auth/auth-provider";
import { ErrorNotice, Page, PageHeader, StatusPill } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

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
type Capabilities = {
  ai: { configured: boolean };
  whatsapp: { configured: boolean };
};

export function AutomationPage() {
  const { isDemoMode } = useAuth();
  const queryClient = useQueryClient();
  const capabilities = useQuery({
    queryKey: ["tenant-capabilities"],
    queryFn: async () => (await apiRequest<{ data: Capabilities }>("/v1/tenant/capabilities", { authenticated: true })).data,
  });
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
  const aiEnabled = useWatch({ control: aiForm.control, name: "enabled" });
  const confidence = useWatch({ control: aiForm.control, name: "minimumConfidence" });
  const currentTone = useWatch({ control: aiForm.control, name: "tone" });
  const hasCustomTone = Boolean(currentTone && !standardTones.some((tone) => tone.value === currentTone));

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
      {capabilities.isError ? <div className="mb-5"><ErrorNotice message={capabilities.error.message} /></div> : null}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="min-w-0 p-4 sm:p-6">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><MessageCircle size={20} /></span><div className="min-w-0"><h2 className="font-semibold">Conectar WhatsApp</h2><p className="mt-1 text-xs leading-5 text-slate-500">Siga um fluxo simples e valide seu número oficial com a Meta.</p></div></div>
            {connection.data ? <StatusPill value={connection.data.status} /> : null}
          </div>

          <ol className="mt-5 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
            <SetupStep number="1" label="Prepare sua conta Meta" />
            <SetupStep number="2" label="Informe os dados solicitados" />
            <SetupStep number="3" label="Valide e conecte" />
          </ol>

          {capabilities.isLoading ? (
            <div className="mt-6 h-32 animate-pulse rounded-xl bg-slate-100" aria-label="Carregando configuração do WhatsApp" />
          ) : !capabilities.data?.whatsapp.configured && !isDemoMode ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <div className="flex items-center gap-2 font-semibold"><CircleAlert size={17} /> Configuração necessária</div>
              <p className="mt-1 text-xs">Defina o segredo do aplicativo e o token de verificação da Meta no servidor antes de conectar um número.</p>
            </div>
          ) : connection.data ? (
            <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><CheckCircle2 size={17} /> Canal conectado</div>
              <dl className="mt-3 text-xs text-emerald-900/70"><div><dt className="font-medium">Número oficial</dt><dd className="mt-1">{connection.data.displayPhoneNumber ?? "Confirmado pela Meta"}</dd></div></dl>
            </div>
          ) : (
            <details className="group mt-5 rounded-xl border border-app-line bg-slate-50/70 open:bg-white">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 text-sm font-semibold text-brand-800 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"><span>Seguir configuração</span><ChevronDown className="transition group-open:rotate-180" size={17} /></summary>
              <form className="grid gap-4 border-t border-app-line p-4" onSubmit={(event) => void whatsappForm.handleSubmit((values) => connect.mutate(values))(event)}>
                {isDemoMode ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><strong>Formulário DEMO:</strong> você pode avaliar os campos. Nenhuma credencial será enviada ou armazenada.</div> : null}
                <div><h3 className="text-sm font-semibold text-slate-800">Dados fornecidos pela Meta</h3><p className="mt-1 text-xs leading-5 text-slate-500">Use os dados do número oficial da empresa. Eles nunca são expostos no navegador após a conexão.</p></div>
                <Field label="ID do número de telefone" hint="Também chamado de Phone Number ID no painel da Meta." error={whatsappForm.formState.errors.phoneNumberId?.message}><Input autoComplete="off" {...whatsappForm.register("phoneNumberId")} /></Field>
                <Field label="ID da conta comercial" hint="Identifica a conta WhatsApp Business da empresa." error={whatsappForm.formState.errors.businessAccountId?.message}><Input autoComplete="off" {...whatsappForm.register("businessAccountId")} /></Field>
                <Field label="Token permanente da Meta" hint="O token é validado e armazenado criptografado pelo servidor." error={whatsappForm.formState.errors.accessToken?.message}><Input type="password" autoComplete="off" {...whatsappForm.register("accessToken")} /></Field>
                {connect.error ? <ErrorNotice message={connect.error.message} /> : null}
                <Button className="w-full sm:w-auto" type="submit" disabled={connect.isPending}><KeyRound size={16} />{connect.isPending ? "Validando…" : "Validar e conectar"}</Button>
              </form>
            </details>
          )}
          <details className="group mt-4 rounded-xl border border-app-line bg-slate-50/70">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"><span className="flex items-center gap-2"><SlidersHorizontal size={15} />Configuração avançada</span><ChevronDown className="transition group-open:rotate-180" size={16} /></summary>
            <div className="break-anywhere border-t border-app-line p-4 text-xs leading-5 text-slate-600">
              {connection.data ? <dl className="mb-3 grid gap-2"><div><dt className="font-semibold text-slate-800">Phone Number ID</dt><dd>{connection.data.phoneNumberId}</dd></div><div><dt className="font-semibold text-slate-800">WABA ID</dt><dd>{connection.data.businessAccountId}</dd></div></dl> : null}
              <strong className="text-slate-800">Webhook:</strong> configure na Meta o endereço <code className="text-emerald-800">{window.location.origin}/v1/webhooks/whatsapp</code> somente durante a integração.
            </div>
          </details>
        </Card>

        <Card className="min-w-0 p-4 sm:p-6">
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700"><Bot size={20} /></span><div><h2 className="font-semibold">Configurar assistente</h2><p className="mt-1 text-xs leading-5 text-slate-500">Defina o comportamento em linguagem simples. A IA responde somente com o conhecimento da empresa.</p></div></div>
          {!capabilities.isLoading && !capabilities.data?.ai.configured ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><div className="flex items-center gap-2 font-semibold"><CircleAlert size={17} /> Configuração necessária</div><p className="mt-1 text-xs">A chave da OpenAI deve ser configurada no servidor. Você pode preparar as regras, mas não ativar respostas automáticas.</p></div> : null}
          <form className="mt-5 grid gap-4" onSubmit={(event) => void aiForm.handleSubmit((values) => saveAi.mutate(values))(event)}>
            <section className="rounded-xl border border-app-line p-4">
              <SectionHeading title="Respostas automáticas" description="Controle quando a assistente pode responder clientes." />
              <label className="mt-4 flex items-start justify-between gap-4"><span><strong className="block text-sm">IA ligada</strong><span className="mt-1 block text-xs leading-5 text-slate-500">Ative somente depois de revisar o conhecimento e testar as respostas.</span></span><input className="mt-0.5 size-5 shrink-0 accent-emerald-700" type="checkbox" disabled={capabilities.isLoading || (!isDemoMode && !capabilities.data?.ai.configured && !aiEnabled)} {...aiForm.register("enabled")} /></label>
            </section>

            <section className="rounded-xl border border-app-line p-4">
              <SectionHeading title="Comportamento e tom de voz" description="Escolha como a assistente se comunica e quão cautelosa ela deve ser." />
              <div className="mt-4 grid gap-4">
                <Field label="Tom de voz" hint="Você poderá personalizar instruções mais específicas em uma etapa futura." error={aiForm.formState.errors.tone?.message}>
                  <>
                    <Select title={currentTone} {...aiForm.register("tone")}>
                      {standardTones.map((tone) => <option key={tone.value} value={tone.value}>{tone.label}</option>)}
                      {hasCustomTone && currentTone ? <option value={currentTone}>Personalizado{isDemoMode ? " — DEMO" : ""}</option> : null}
                    </Select>
                    {hasCustomTone && currentTone ? <span className="break-anywhere text-xs font-normal leading-5 text-slate-500"><strong className="font-medium text-slate-600">Configuração atual:</strong> {currentTone}</span> : null}
                  </>
                </Field>
                <fieldset>
                  <legend className="text-sm font-medium text-slate-700">Quando houver dúvida</legend>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Quanto mais cautelosa, mais cedo a conversa vai para uma pessoa.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <ConfidenceOption label="Mais cautelosa" description="Transfere mais cedo" active={confidenceBand(confidence) === "cautious"} onSelect={() => aiForm.setValue("minimumConfidence", 0.9, { shouldDirty: true, shouldValidate: true })} />
                    <ConfidenceOption label="Equilibrada" description="Recomendado" active={confidenceBand(confidence) === "balanced"} onSelect={() => aiForm.setValue("minimumConfidence", 0.8, { shouldDirty: true, shouldValidate: true })} />
                    <ConfidenceOption label="Mais flexível" description="Exige revisão" active={confidenceBand(confidence) === "flexible"} onSelect={() => aiForm.setValue("minimumConfidence", 0.7, { shouldDirty: true, shouldValidate: true })} />
                  </div>
                </fieldset>
              </div>
            </section>

            <section className="rounded-xl border border-app-line p-4">
              <SectionHeading title="Transferência para humano" description="Mensagens claras evitam que o cliente pense que a IA inventou uma resposta." icon={<UserRoundCheck size={17} />} />
              <div className="mt-4 grid gap-4">
                <Field label="Quando não encontrar uma resposta" hint="Opcional. Se vazio, o sistema usa uma mensagem segura padrão."><Textarea className="min-h-24 resize-none overflow-y-auto" rows={3} wrap="soft" placeholder="Não encontrei essa informação. Vou chamar nossa equipe." {...aiForm.register("fallbackMessage")} /></Field>
                <Field label="Ao transferir para uma pessoa" hint="Opcional. Informe o que o cliente pode esperar."><Textarea className="min-h-24 resize-none overflow-y-auto" rows={3} wrap="soft" placeholder="Um atendente continuará esta conversa." {...aiForm.register("transferMessage")} /></Field>
              </div>
            </section>

            <details className="group rounded-xl border border-app-line bg-slate-50/70">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"><span className="flex items-center gap-2"><SlidersHorizontal size={15} />Opções avançadas</span><ChevronDown className="transition group-open:rotate-180" size={16} /></summary>
              <div className="grid gap-4 border-t border-app-line p-4 sm:grid-cols-2">
                <Field label="Confiança técnica" hint="0,50 a 1,00. Valores maiores tornam a IA mais cautelosa." error={aiForm.formState.errors.minimumConfidence?.message}><Input type="number" min="0.5" max="1" step="0.05" {...aiForm.register("minimumConfidence", { valueAsNumber: true })} /></Field>
                <Field label="Mensagens consideradas" hint="Quantidade máxima do histórico usada como contexto." error={aiForm.formState.errors.maxContextMessages?.message}><Input type="number" min="1" max="50" {...aiForm.register("maxContextMessages", { valueAsNumber: true })} /></Field>
              </div>
            </details>
            {saveAi.error ? <ErrorNotice message={saveAi.error.message} /> : null}
            {saveAi.isSuccess ? <p className="flex items-center gap-2 text-sm text-emerald-700"><ShieldCheck size={17} /> Configuração salva e auditada.</p> : null}
            <Button className="w-full sm:w-auto sm:justify-self-end" type="submit" disabled={saveAi.isPending}>{saveAi.isPending ? "Salvando…" : "Salvar configuração"}</Button>
          </form>
        </Card>
      </div>
    </Page>
  );
}

const standardTones = [
  { value: "profissional e cordial", label: "Profissional e cordial" },
  { value: "acolhedor e próximo", label: "Acolhedor e próximo" },
  { value: "objetivo e direto", label: "Objetivo e direto" },
] as const;

function SetupStep({ number, label }: { number: string; label: string }) {
  return <li className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-800">{number}</span><span>{label}</span></li>;
}

function SectionHeading({ title, description, icon }: { title: string; description: string; icon?: ReactNode }) {
  return <div><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">{icon}{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div>;
}

function ConfidenceOption({ label, description, active, onSelect }: { label: string; description: string; active: boolean; onSelect: () => void }) {
  return <button className={cn("min-h-16 rounded-xl border px-3 py-2 text-left transition", active ? "border-brand-500 bg-brand-50 text-brand-900 ring-1 ring-brand-500" : "border-app-line bg-white text-slate-700 hover:border-brand-200")} type="button" onClick={onSelect} aria-pressed={active}><strong className="block text-xs">{label}</strong><span className="mt-1 block text-[11px] text-slate-500">{description}</span></button>;
}

function confidenceBand(value: number | undefined): "cautious" | "balanced" | "flexible" {
  if ((value ?? 0.8) >= 0.86) return "cautious";
  if ((value ?? 0.8) >= 0.76) return "balanced";
  return "flexible";
}
