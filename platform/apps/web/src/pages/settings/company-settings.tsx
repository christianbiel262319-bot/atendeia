import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/auth/auth-provider";
import { ErrorNotice, LoadingState, StatusPill, SuccessNotice } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiRequest } from "@/lib/api";

const schema = z.object({ name: z.string().trim().min(2, "Informe o nome da empresa").max(160), timezone: z.string().min(1) });
type Values = z.infer<typeof schema>;
type TenantProfile = { id: string; name: string; slug: string; timezone: string; status: string; createdAt: string };

const timezones = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Fortaleza",
  "America/Recife",
  "America/Bahia",
  "America/Cuiaba",
  "America/Porto_Velho",
  "America/Rio_Branco",
];

export function CompanySettings() {
  const { profile } = useAuth();
  const tenant = useQuery({ queryKey: ["tenant-profile"], queryFn: async () => (await apiRequest<{ data: TenantProfile }>("/v1/tenant/profile", { authenticated: true })).data });
  if (tenant.isLoading) return <LoadingState label="Carregando empresa" />;
  if (tenant.isError) return <ErrorNotice message={tenant.error.message} />;
  if (!tenant.data) return null;
  return <CompanyForm key={`${tenant.data.name}-${tenant.data.timezone}`} tenant={tenant.data} canEdit={profile?.role === "OWNER" || profile?.role === "ADMIN"} />;
}

function CompanyForm({ tenant, canEdit }: { tenant: TenantProfile; canEdit: boolean }) {
  const { reloadProfile } = useAuth();
  const queryClient = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: tenant.name, timezone: tenant.timezone } });
  const save = useMutation({
    mutationFn: async (values: Values) => apiRequest("/v1/tenant/profile", { method: "PATCH", authenticated: true, body: JSON.stringify(values) }),
    onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["tenant-profile"] }), reloadProfile()]); },
  });
  return (
    <Card className="p-5 sm:p-7">
      <div className="flex flex-wrap items-start gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Building2 size={23} /></span><div className="min-w-56 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">Identidade da empresa</h2><StatusPill value={tenant.status} /></div><p className="mt-2 text-sm leading-6 text-slate-500">O nome aparece na navegação e o fuso é usado em horários e eventos.</p></div></div>
      <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={(event) => void form.handleSubmit((values) => save.mutate(values))(event)}>
        <Field label="Nome da empresa" error={form.formState.errors.name?.message}><Input disabled={!canEdit} {...form.register("name")} /></Field>
        <Field label="Fuso horário"><Select disabled={!canEdit} {...form.register("timezone")}>{timezones.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}</Select></Field>
        <Field label="Identificador público"><Input disabled value={tenant.slug} /></Field>
        <Field label="Criada em"><Input disabled value={new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(tenant.createdAt))} /></Field>
        <div className="grid gap-3 sm:col-span-2">{!canEdit ? <p className="rounded-brand bg-slate-50 p-4 text-sm text-slate-600">Seu perfil pode consultar, mas não alterar os dados da empresa.</p> : null}{save.error ? <ErrorNotice message={save.error.message} /> : null}{save.isSuccess ? <SuccessNotice message="Dados da empresa atualizados e auditados." /> : null}{canEdit ? <Button className="w-fit" type="submit" disabled={save.isPending || !form.formState.isDirty}>{save.isPending ? "Salvando…" : "Salvar empresa"}</Button> : null}</div>
      </form>
    </Card>
  );
}
