import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, KeyRound, Laptop, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/auth/auth-provider";
import { EmptyState, ErrorNotice, LoadingState, SuccessNotice } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

type MfaSetup = { secret: string; otpauthUri: string };
type Session = { id: string; deviceLabel: string | null; createdAt: string; lastUsedAt: string | null; expiresAt: string; current: boolean };
const disableSchema = z.object({ password: z.string().min(1, "Informe sua senha"), code: z.string().regex(/^\d{6}$/, "Informe os seis números") });
type DisableValues = z.infer<typeof disableSchema>;

export function SecuritySettings() {
  const { profile, reloadProfile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [sessionTarget, setSessionTarget] = useState<Session | null>(null);
  const disableForm = useForm<DisableValues>({ resolver: zodResolver(disableSchema), defaultValues: { password: "", code: "" } });
  const sessions = useQuery({ queryKey: ["auth-sessions"], queryFn: async () => (await apiRequest<{ data: Session[] }>("/v1/auth/sessions", { authenticated: true })).data });
  const begin = useMutation({ mutationFn: async () => (await apiRequest<{ data: MfaSetup }>("/v1/auth/mfa/setup", { method: "POST", authenticated: true, csrf: true })).data, onSuccess: (data) => { setSetup(data); setCopied(false); } });
  const confirm = useMutation({ mutationFn: async () => apiRequest("/v1/auth/mfa/confirm", { method: "POST", authenticated: true, csrf: true, body: JSON.stringify({ code }) }), onSuccess: async () => { setSetup(null); setCode(""); await reloadProfile(); } });
  const disable = useMutation({ mutationFn: async (values: DisableValues) => apiRequest("/v1/auth/mfa/disable", { method: "POST", authenticated: true, csrf: true, body: JSON.stringify(values) }), onSuccess: async () => { setDisableOpen(false); disableForm.reset(); await reloadProfile(); } });
  const revoke = useMutation({
    mutationFn: async (session: Session) => apiRequest<{ data: { current: boolean } }>(`/v1/auth/sessions/${session.id}`, { method: "DELETE", authenticated: true, csrf: true }),
    onSuccess: async (result) => {
      setSessionTarget(null);
      if (result.data.current) await signOut();
      else await queryClient.invalidateQueries({ queryKey: ["auth-sessions"] });
    },
  });
  const revokeOthers = useMutation({ mutationFn: async () => apiRequest("/v1/auth/sessions/revoke-others", { method: "POST", authenticated: true, csrf: true }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["auth-sessions"] }); } });

  async function copySecret(): Promise<void> {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-5">
      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-violet-50 text-violet-700"><ShieldCheck size={23} /></span><div className="min-w-56 flex-1"><h2 className="font-semibold">Autenticação multifator</h2><p className="mt-2 text-sm leading-6 text-slate-500">O MFA é aplicado ao seu acesso a <strong>{profile?.tenant.name}</strong>. Cada código só pode ser utilizado uma vez.</p></div>{profile?.mfaEnabled ? <div className="flex items-center gap-2"><span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700"><CheckCircle2 size={15} /> Ativado</span><Button variant="outline" size="sm" onClick={() => setDisableOpen(true)}>Desativar</Button></div> : <Button disabled={begin.isPending} onClick={() => begin.mutate()}><KeyRound size={16} />{begin.isPending ? "Preparando…" : "Ativar MFA"}</Button>}</div>
        {begin.error ? <div className="mt-5"><ErrorNotice message={begin.error.message} /></div> : null}
        {confirm.isSuccess ? <div className="mt-5"><SuccessNotice message="MFA ativado e registrado na auditoria." /></div> : null}
        {setup ? <div className="mt-6 grid gap-5 border-t border-app-line pt-6"><div className="rounded-brand border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Antes de continuar:</strong> adicione a chave ao aplicativo autenticador. Ela será substituída se a configuração for reiniciada.<div className="mt-3 flex flex-wrap items-center gap-2"><code className="break-all rounded-lg bg-white px-3 py-2 text-xs">{setup.secret}</code><Button variant="outline" size="sm" onClick={() => void copySecret()}>{copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}{copied ? "Copiado" : "Copiar"}</Button></div></div><Field label="Código de seis números"><Input className="max-w-56 text-center text-xl tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/gu, ""))} /></Field>{confirm.error ? <ErrorNotice message={confirm.error.message} /> : null}<Button className="w-fit" disabled={code.length !== 6 || confirm.isPending} onClick={() => confirm.mutate()}>{confirm.isPending ? "Verificando…" : "Confirmar e ativar"}</Button></div> : null}
      </Card>

      <Card className="p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold">Sessões ativas</h2><p className="mt-2 text-sm leading-6 text-slate-500">Revogue dispositivos que você não reconhece. Endereços e tokens não são exibidos.</p></div>{(sessions.data?.length ?? 0) > 1 ? <Button variant="outline" size="sm" disabled={revokeOthers.isPending} onClick={() => revokeOthers.mutate()}>{revokeOthers.isPending ? "Encerrando…" : "Encerrar as outras"}</Button> : null}</div>
        <div className="mt-6">{sessions.isLoading ? <LoadingState label="Carregando sessões" /> : sessions.isError ? <ErrorNotice message={sessions.error.message} /> : sessions.data?.length === 0 ? <EmptyState title="Nenhuma sessão ativa" description="Entre novamente para criar uma nova sessão." /> : <div className="divide-y divide-app-line">{sessions.data?.map((session) => <div className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0" key={session.id}><span className="grid size-10 place-items-center rounded-brand bg-slate-100 text-slate-500">{session.deviceLabel?.includes("Android") || session.deviceLabel?.includes("iOS") ? <Smartphone size={18} /> : <Laptop size={18} />}</span><div className="min-w-52 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{session.deviceLabel ?? "Dispositivo não identificado"}</strong>{session.current ? <span className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-700">ESTA SESSÃO</span> : null}</div><p className="mt-1 text-xs text-slate-500">Criada em {dateTime(session.createdAt)} · expira em {dateTime(session.expiresAt)}</p></div><Button variant="ghost" size="sm" disabled={revoke.isPending} onClick={() => setSessionTarget(session)}><LogOut size={15} />{session.current ? "Sair" : "Encerrar"}</Button></div>)}</div>}</div>
        {revokeOthers.error ? <div className="mt-4"><ErrorNotice message={revokeOthers.error.message} /></div> : null}{revokeOthers.isSuccess ? <div className="mt-4"><SuccessNotice message="Outras sessões encerradas." /></div> : null}
      </Card>

      <Dialog open={disableOpen} onClose={() => setDisableOpen(false)} titleId="disable-mfa-title"><section className="w-full max-w-md rounded-[var(--radius-dialog)] border border-app-line bg-white p-6 shadow-dialog"><h2 className="text-lg font-semibold" id="disable-mfa-title">Desativar MFA?</h2><p className="mt-2 text-sm leading-6 text-slate-500">Confirme sua senha e um código atual. Isso reduz a proteção desta empresa.</p><form className="mt-5 grid gap-4" onSubmit={(event) => void disableForm.handleSubmit((values) => disable.mutate(values))(event)}><Field label="Senha" error={disableForm.formState.errors.password?.message}><Input autoComplete="current-password" type="password" {...disableForm.register("password")} /></Field><Field label="Código atual" error={disableForm.formState.errors.code?.message}><Input autoComplete="one-time-code" inputMode="numeric" maxLength={6} {...disableForm.register("code")} /></Field>{disable.error ? <ErrorNotice message={disable.error.message} /> : null}<div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setDisableOpen(false)}>Cancelar</Button><Button type="submit" disabled={disable.isPending}>{disable.isPending ? "Desativando…" : "Confirmar"}</Button></div></form></section></Dialog>
      <Dialog open={Boolean(sessionTarget)} onClose={() => setSessionTarget(null)} titleId="revoke-session-title"><section className="w-full max-w-md rounded-[var(--radius-dialog)] border border-app-line bg-white p-6 shadow-dialog"><h2 className="text-lg font-semibold" id="revoke-session-title">{sessionTarget?.current ? "Sair deste dispositivo?" : "Encerrar esta sessão?"}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{sessionTarget?.current ? "Você precisará entrar novamente para continuar." : `${sessionTarget?.deviceLabel ?? "O dispositivo"} perderá o acesso ao renovar a sessão.`}</p>{revoke.error ? <div className="mt-4"><ErrorNotice message={revoke.error.message} /></div> : null}<div className="mt-6 flex justify-end gap-3"><Button variant="outline" onClick={() => setSessionTarget(null)}>Cancelar</Button><Button disabled={!sessionTarget || revoke.isPending} onClick={() => sessionTarget && revoke.mutate(sessionTarget)}>{revoke.isPending ? "Encerrando…" : "Confirmar"}</Button></div></section></Dialog>
    </div>
  );
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
