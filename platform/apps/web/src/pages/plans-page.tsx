import { useMutation, useQuery } from "@tanstack/react-query";
import { CreditCard, ExternalLink, ReceiptText, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/auth/auth-provider";
import { EmptyState, ErrorNotice, Page, PageHeader, StatusPill } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiRequest } from "@/lib/api";

type Plan = { id: string; code: string; name: string; monthlyPrice: string; currency: string; limits: Record<string, string | number | boolean> };
type Payment = { id: string; amount: string; currency: string; status: string; createdAt: string };
type Subscription = { id: string; provider: string; status: string; currentPeriodEnd: string | null; plan: Plan; payments: Payment[] };

export function PlansPage() {
  const { profile } = useAuth();
  const [provider, setProvider] = useState<"STRIPE" | "MERCADO_PAGO" | "ASAAS">("STRIPE");
  const [taxId, setTaxId] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const plans = useQuery({ queryKey: ["billing-plans"], queryFn: async () => (await apiRequest<{ data: Plan[] }>("/v1/billing/plans", { authenticated: true })).data });
  const current = useQuery({ queryKey: ["billing-subscription"], queryFn: async () => (await apiRequest<{ data: Subscription | null }>("/v1/billing/subscription", { authenticated: true })).data });
  const checkout = useMutation({
    mutationFn: async (planId: string) => (await apiRequest<{ data: { redirectUrl: string } }>("/v1/billing/checkout", { method: "POST", authenticated: true, body: JSON.stringify({ planId, provider, ...(taxId ? { taxId } : {}) }) })).data,
    onSuccess: (data) => window.location.assign(data.redirectUrl),
  });
  const cancel = useMutation({
    mutationFn: async () => apiRequest("/v1/billing/subscription", { method: "DELETE", authenticated: true }),
    onSuccess: async () => { setConfirmCancel(false); await current.refetch(); },
  });
  const canBuy = profile?.role === "OWNER" || profile?.role === "ADMIN";
  const hasCurrent = Boolean(current.data && current.data.status !== "CANCELED");
  return <Page><PageHeader eyebrow="PLANOS E COBRANÇA" title="Assinatura" description="Escolha um plano cadastrado pela plataforma e conclua a cobrança diretamente no provedor selecionado." />
    {current.data ? <Card className="mb-6 p-5 sm:p-6"><div className="flex flex-wrap items-center gap-4"><span className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><ShieldCheck size={21} /></span><div className="min-w-48 flex-1"><span className="text-[10px] font-bold tracking-wider text-slate-400">ASSINATURA ATUAL</span><div className="mt-1 flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{current.data.plan.name}</h2><StatusPill value={current.data.status} /></div><p className="mt-1 text-xs text-slate-500">Provedor: {providerLabel(current.data.provider)}{current.data.currentPeriodEnd ? ` · período até ${dateLabel(current.data.currentPeriodEnd)}` : ""}</p></div>{canBuy && current.data.status !== "CANCELED" ? confirmCancel ? <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setConfirmCancel(false)}>Manter plano</Button><Button size="sm" className="bg-red-700 hover:bg-red-800" disabled={cancel.isPending} onClick={() => cancel.mutate()}>{cancel.isPending ? "Cancelando…" : "Confirmar cancelamento"}</Button></div> : <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(true)}>Cancelar assinatura</Button> : null}</div>{cancel.error ? <div className="mt-4"><ErrorNotice message={cancel.error.message} /></div> : null}{current.data.payments.length > 0 ? <div className="mt-5 border-t border-slate-100 pt-5"><h3 className="flex items-center gap-2 text-sm font-semibold"><ReceiptText size={16} /> Cobranças recentes</h3><div className="mt-3 grid gap-2">{current.data.payments.map((payment) => <div key={payment.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-xs"><span>{dateLabel(payment.createdAt)}</span><span className="font-semibold">{money(payment.amount, payment.currency)}</span><StatusPill value={payment.status} /></div>)}</div></div> : null}</Card> : null}
    {!hasCurrent ? <Card className="mb-6 p-5"><div className="grid gap-4 sm:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_1fr_1fr]"><Field label="Provedor de pagamento"><Select value={provider} onChange={(event) => setProvider(event.target.value as typeof provider)}><option value="STRIPE">Stripe</option><option value="MERCADO_PAGO">Mercado Pago</option><option value="ASAAS">Asaas</option></Select></Field>{provider === "ASAAS" ? <Field label="CPF ou CNPJ do pagador"><Input inputMode="numeric" value={taxId} onChange={(event) => setTaxId(event.target.value)} /></Field> : null}<div className="flex items-end pb-3 text-xs leading-5 text-slate-500"><CreditCard className="mr-2 shrink-0 text-emerald-700" size={17} />A página segura de pagamento será aberta fora do AtendeIA.</div></div></Card> : null}
    {plans.isError ? <ErrorNotice message={plans.error.message} /> : null}{checkout.error ? <div className="mb-5"><ErrorNotice message={checkout.error.message} /></div> : null}
    {!plans.isLoading && plans.data?.length === 0 ? <EmptyState title="Nenhum plano disponível" description="O catálogo ainda não foi publicado pelo administrador da plataforma. Nenhum valor fictício será exibido." /> : <div className="grid gap-4 lg:grid-cols-3">{plans.data?.map((plan) => <Card key={plan.id} className="flex flex-col p-6"><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">{plan.code}</span><h2 className="mt-2 text-xl font-semibold">{plan.name}</h2><p className="mt-4 text-3xl font-semibold tracking-tight">{money(plan.monthlyPrice, plan.currency)}<span className="text-sm font-normal text-slate-400">/mês</span></p><ul className="my-6 grid flex-1 gap-2 text-sm text-slate-600">{Object.entries(plan.limits).map(([key, value]) => <li key={key} className="flex items-start gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-600" /><span>{humanize(key)}: <strong className="text-slate-800">{String(value)}</strong></span></li>)}</ul><Button disabled={!canBuy || hasCurrent || checkout.isPending || (provider === "ASAAS" && taxId.replace(/\D/gu, "").length < 11)} onClick={() => checkout.mutate(plan.id)}>{checkout.isPending ? "Abrindo…" : hasCurrent ? "Plano atual definido" : "Escolher plano"}<ExternalLink size={15} /></Button></Card>)}</div>}
  </Page>;
}

function money(value: string, currency: string): string { return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(value)); }
function dateLabel(value: string): string { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value)); }
function providerLabel(value: string): string { return value === "MERCADO_PAGO" ? "Mercado Pago" : value === "ASAAS" ? "Asaas" : "Stripe"; }
function humanize(value: string): string { return value.replace(/([A-Z])/gu, " $1").replaceAll("_", " ").trim().toLowerCase(); }
