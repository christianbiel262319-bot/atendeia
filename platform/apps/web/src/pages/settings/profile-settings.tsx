import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleAlert, MailCheck, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/auth/auth-provider";
import { ErrorNotice, SuccessNotice } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

const profileSchema = z.object({ fullName: z.string().trim().min(2, "Informe seu nome").max(160) });
const password = z.string().min(12, "Use pelo menos 12 caracteres").regex(/[a-z]/, "Inclua uma letra minúscula").regex(/[A-Z]/, "Inclua uma letra maiúscula").regex(/\d/, "Inclua um número").regex(/[^A-Za-z0-9]/, "Inclua um caractere especial");
const passwordSchema = z.object({ currentPassword: z.string().min(1, "Informe a senha atual"), newPassword: password, confirmation: z.string() }).refine((input) => input.newPassword === input.confirmation, { path: ["confirmation"], message: "As senhas não coincidem" });
type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export function ProfileSettings() {
  const { profile, reloadProfile } = useAuth();
  const capabilities = useQuery({ queryKey: ["auth-capabilities"], queryFn: async () => (await apiRequest<{ data: { emailDelivery: boolean } }>("/v1/auth/capabilities")).data, retry: false });
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: { fullName: profile?.user.fullName ?? "" } });
  const passwordForm = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: "", newPassword: "", confirmation: "" } });
  const save = useMutation({ mutationFn: async (values: ProfileValues) => apiRequest("/v1/auth/profile", { method: "PATCH", authenticated: true, csrf: true, body: JSON.stringify(values) }), onSuccess: async () => { await reloadProfile(); } });
  const requestVerification = useMutation({ mutationFn: async () => apiRequest("/v1/auth/email/request", { method: "POST", authenticated: true, csrf: true }) });
  const changePassword = useMutation({ mutationFn: async (values: PasswordValues) => apiRequest("/v1/auth/password/change", { method: "POST", authenticated: true, csrf: true, body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }) }), onSuccess: () => passwordForm.reset() });
  const emailConfigured = capabilities.data?.emailDelivery !== false;

  return (
    <div className="grid gap-5">
      <Card className="p-5 sm:p-7"><div className="flex items-start gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700"><UserRound size={23} /></span><div><h2 className="font-semibold">Perfil pessoal</h2><p className="mt-2 text-sm leading-6 text-slate-500">O nome identifica suas respostas e ações auditadas.</p></div></div><form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={(event) => void form.handleSubmit((values) => save.mutate(values))(event)}><Field label="Nome completo" error={form.formState.errors.fullName?.message}><Input autoComplete="name" {...form.register("fullName")} /></Field><Field label="E-mail"><Input disabled value={profile?.user.email ?? ""} /></Field><div className="grid gap-3 sm:col-span-2">{save.error ? <ErrorNotice message={save.error.message} /> : null}{save.isSuccess ? <SuccessNotice message="Perfil atualizado." /> : null}<Button className="w-fit" type="submit" disabled={save.isPending || !form.formState.isDirty}>{save.isPending ? "Salvando…" : "Salvar perfil"}</Button></div></form>
        <div className="mt-6 border-t border-app-line pt-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="text-sm font-semibold">Verificação do e-mail</h3><p className="mt-1 text-xs leading-5 text-slate-500">{profile?.user.emailVerifiedAt ? "Seu e-mail já foi confirmado." : "Confirme o endereço usado para comunicações de segurança."}</p></div>{profile?.user.emailVerifiedAt ? <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700"><MailCheck size={15} /> Verificado</span> : <Button variant="outline" size="sm" disabled={requestVerification.isPending || capabilities.isLoading || !emailConfigured} onClick={() => requestVerification.mutate()}>{requestVerification.isPending ? "Enviando…" : !emailConfigured ? "Configuração necessária" : "Enviar verificação"}</Button>}</div>{!profile?.user.emailVerifiedAt && !capabilities.isLoading && !emailConfigured ? <div className="mt-4 flex items-start gap-2 rounded-brand border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><CircleAlert className="mt-0.5 shrink-0" size={16} /> O envio transacional precisa ser configurado no servidor.</div> : null}{requestVerification.error ? <div className="mt-4"><ErrorNotice message={requestVerification.error.message} /></div> : null}{requestVerification.isSuccess ? <div className="mt-4"><SuccessNotice message="Se o endereço estiver elegível, o e-mail de verificação foi solicitado." /></div> : null}</div>
      </Card>
      <Card className="p-5 sm:p-7"><h2 className="font-semibold">Alterar senha</h2><p className="mt-2 text-sm leading-6 text-slate-500">A alteração encerra as outras sessões e mantém somente este dispositivo conectado.</p><form className="mt-6 grid gap-5" onSubmit={(event) => void passwordForm.handleSubmit((values) => changePassword.mutate(values))(event)}><Field label="Senha atual" error={passwordForm.formState.errors.currentPassword?.message}><Input autoComplete="current-password" type="password" {...passwordForm.register("currentPassword")} /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="Nova senha" error={passwordForm.formState.errors.newPassword?.message}><Input autoComplete="new-password" type="password" {...passwordForm.register("newPassword")} /></Field><Field label="Confirme a nova senha" error={passwordForm.formState.errors.confirmation?.message}><Input autoComplete="new-password" type="password" {...passwordForm.register("confirmation")} /></Field></div>{changePassword.error ? <ErrorNotice message={changePassword.error.message} /> : null}{changePassword.isSuccess ? <SuccessNotice message="Senha alterada e outras sessões encerradas." /> : null}<Button className="w-fit" type="submit" disabled={changePassword.isPending}>{changePassword.isPending ? "Alterando…" : "Alterar senha"}</Button></form></Card>
    </div>
  );
}
