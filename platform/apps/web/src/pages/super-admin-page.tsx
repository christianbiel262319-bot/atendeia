import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CreditCard, MessageCircle, Plus, ServerCog, Users } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/auth/auth-provider";
import { ErrorNotice, Page, PageHeader, StatusPill } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiRequest } from "@/lib/api";

const planSchema = z.object({
  code: z.string().trim().min(2).regex(/^[a-z0-9-]+$/u, "Use letras minúsculas, números e hífen"),
  name: z.string().trim().min(2),
  monthlyPrice: z.number().nonnegative(),
  limitsJson: z.string().refine((value) => { try { const parsed = JSON.parse(value) as unknown; return Boolean(parsed && typeof parsed === "object" && !Array.isArray(parsed)); } catch { return false; } }, "Informe um objeto JSON válido"),
});
type PlanValues = z.infer<typeof planSchema>;
type Overview = { tenants: number; users: number; activeSubscriptions: number; openConversations: number; webhookFailures: number };
type Tenant = { id: string; name: string; slug: string; status: string; createdAt: string; _count: { memberships: number; conversations: number }; subscriptions: Array<{ status: string; provider: string; plan: { code: string; name: string } }> };
type Plan = { id: string; code: string; name: string; monthlyPrice: string; currency: string; active: boolean; limits: Record<string, unknown> };

export function SuperAdminPage() {
  const { profile, isDemoMode } = useAuth();
  const queryClient = useQueryClient();
  const overview = useQuery({ queryKey: ["super-overview"], queryFn: async () => (await apiRequest<{ data: Overview }>("/v1/super-admin/overview", { authenticated: true })).data, enabled: Boolean(profile?.user.isSuperAdmin) });
  const tenants = useQuery({ queryKey: ["super-tenants"], queryFn: async () => (await apiRequest<{ data: Tenant[] }>("/v1/super-admin/tenants", { authenticated: true })).data, enabled: Boolean(profile?.user.isSuperAdmin) });
  const plans = useQuery({ queryKey: ["super-plans"], queryFn: async () => (await apiRequest<{ data: Plan[] }>("/v1/super-admin/plans", { authenticated: true })).data, enabled: Boolean(profile?.user.isSuperAdmin) });
  const form = useForm<PlanValues>({ resolver: zodResolver(planSchema), defaultValues: { code: "", name: "", monthlyPrice: 0, limitsJson: "{}" } });
  const createPlan = useMutation({ mutationFn: async (values: PlanValues) => apiRequest("/v1/super-admin/plans", { method: "POST", authenticated: true, body: JSON.stringify({ code: values.code, name: values.name, monthlyPrice: values.monthlyPrice, currency: "BRL", limits: JSON.parse(values.limitsJson) as Record<string, unknown>, active: true }) }), onSuccess: async () => { form.reset(); await Promise.all([queryClient.invalidateQueries({ queryKey: ["super-plans"] }), queryClient.invalidateQueries({ queryKey: ["billing-plans"] })]); } });
  if (!profile?.user.isSuperAdmin) return <Navigate to="/" replace />;
  const stats = overview.data;
  return <Page><PageHeader eyebrow="PLATAFORMA" title="Super Admin" description="Visão global explícita e separada do contexto operacional de cada empresa." />
    {overview.isError ? <ErrorNotice message={overview.error.message} /> : null}<div className="grid grid-cols-2 gap-3 xl:grid-cols-5"><Metric icon={Building2} label="Empresas" value={stats?.tenants} /><Metric icon={Users} label="Usuários" value={stats?.users} /><Metric icon={CreditCard} label="Assinaturas ativas" value={stats?.activeSubscriptions} /><Metric icon={MessageCircle} label="Conversas abertas" value={stats?.openConversations} /><Metric icon={ServerCog} label="Webhooks com falha" value={stats?.webhookFailures} /></div>
    <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_390px]"><Card className="min-w-0 overflow-hidden"><div className="border-b border-slate-100 p-4 sm:p-5"><h2 className="font-semibold">Empresas</h2></div><div className="divide-y divide-slate-100">{tenants.data?.map((tenant) => <TenantRow key={tenant.id} tenant={tenant} />)}</div></Card><Card className="h-fit min-w-0 p-4 sm:p-5"><div className="flex items-center gap-2"><Plus size={17} className="shrink-0 text-emerald-700" /><h2 className="font-semibold">{isDemoMode ? "Simular publicação — DEMO" : "Publicar plano real"}</h2></div>{isDemoMode ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">A validação do formulário é demonstrativa. Nenhum plano será criado ou publicado.</p> : null}<form className="mt-5 grid gap-4" onSubmit={(event) => void form.handleSubmit((values) => createPlan.mutate(values))(event)}><Field label="Código" error={form.formState.errors.code?.message}><Input placeholder="ex.: essencial" {...form.register("code")} /></Field><Field label="Nome" error={form.formState.errors.name?.message}><Input {...form.register("name")} /></Field><Field label="Mensalidade (BRL)" error={form.formState.errors.monthlyPrice?.message}><Input type="number" min="0" step="0.01" {...form.register("monthlyPrice", { valueAsNumber: true })} /></Field><Field label="Limites em JSON" error={form.formState.errors.limitsJson?.message}><Input placeholder='{"conversas": 1000}' {...form.register("limitsJson")} /></Field>{createPlan.error ? <ErrorNotice message={createPlan.error.message} /> : null}<Button className="w-full" type="submit" disabled={createPlan.isPending}>{createPlan.isPending ? (isDemoMode ? "Simulando…" : "Publicando…") : (isDemoMode ? "Simular publicação — DEMO" : "Publicar plano")}</Button></form><div className="mt-6 border-t border-slate-100 pt-5"><h3 className="text-xs font-bold tracking-wide text-slate-400">CATÁLOGO</h3><div className="mt-3 grid gap-2">{plans.data?.map((plan) => <div key={plan.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-xs"><span className="min-w-0"><strong className="block truncate">{plan.name}</strong><span className="break-anywhere mt-1 block text-slate-400">{plan.code}</span></span><span className="shrink-0 font-semibold">R$ {Number(plan.monthlyPrice).toFixed(2)}</span></div>)}</div></div></Card></div>
  </Page>;
}

function TenantRow({ tenant }: { tenant: Tenant }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(tenant.status);
  const [reason, setReason] = useState("");
  const update = useMutation({ mutationFn: async () => apiRequest(`/v1/super-admin/tenants/${tenant.id}/status`, { method: "PATCH", authenticated: true, body: JSON.stringify({ status, reason }) }), onSuccess: async () => { setReason(""); await Promise.all([queryClient.invalidateQueries({ queryKey: ["super-tenants"] }), queryClient.invalidateQueries({ queryKey: ["super-overview"] })]); } });
  return <div className="min-w-0 p-4 sm:p-5"><div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-start sm:gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="break-anywhere text-sm">{tenant.name}</strong><StatusPill value={tenant.status} /></div><p className="break-anywhere mt-1 text-xs leading-5 text-slate-400">{tenant.slug} · {tenant._count.memberships} pessoa(s) · {tenant._count.conversations} conversa(s)</p></div><Select className="w-full" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ACTIVE">Ativa</option><option value="SUSPENDED">Suspensa</option><option value="CANCELED">Cancelada</option></Select></div>{status !== tenant.status ? <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input className="min-w-0 flex-1" placeholder="Motivo obrigatório da alteração" value={reason} onChange={(event) => setReason(event.target.value)} /><Button className="w-full sm:w-auto" size="sm" disabled={reason.trim().length < 5 || update.isPending} onClick={() => update.mutate()}>Confirmar</Button></div> : null}{update.error ? <div className="mt-3"><ErrorNotice message={update.error.message} /></div> : null}</div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: number | undefined }) { return <Card className="flex min-w-0 items-center gap-2 p-3 sm:gap-3 sm:p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon size={17} /></span><div className="min-w-0"><span className="block text-[11px] leading-4 text-slate-500">{label}</span><strong className="mt-1 block text-lg sm:text-xl">{value ?? "—"}</strong></div></Card>; }
