import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Copy, KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/auth/auth-provider";
import { ErrorNotice, Page, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

type MfaSetup = { secret: string; otpauthUri: string };

export function SettingsPage() {
  const { profile, reloadProfile } = useAuth();
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState("");
  const begin = useMutation({ mutationFn: async () => (await apiRequest<{ data: MfaSetup }>("/v1/auth/mfa/setup", { method: "POST", authenticated: true })).data, onSuccess: setSetup });
  const confirm = useMutation({ mutationFn: async () => apiRequest("/v1/auth/mfa/confirm", { method: "POST", authenticated: true, body: JSON.stringify({ code }) }), onSuccess: async () => { setSetup(null); setCode(""); await reloadProfile(); } });
  return <Page width="max-w-4xl"><PageHeader eyebrow="CONFIGURAÇÕES" title="Segurança da conta" description="Proteja o acesso a esta empresa com um segundo fator TOTP." />
    <Card className="p-5 sm:p-7"><div className="flex flex-wrap items-start gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-violet-50 text-violet-700"><ShieldCheck size={23} /></span><div className="min-w-56 flex-1"><h2 className="font-semibold">Autenticação multifator</h2><p className="mt-2 text-sm leading-6 text-slate-500">O MFA é aplicado à sua associação com <strong>{profile?.tenant.name}</strong>. Cada código só pode ser utilizado uma vez.</p></div>{profile?.mfaEnabled ? <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><CheckCircle2 size={15} /> Ativado</span> : <Button disabled={begin.isPending} onClick={() => begin.mutate()}><KeyRound size={16} />{begin.isPending ? "Preparando…" : "Ativar MFA"}</Button>}</div>
      {begin.error ? <div className="mt-5"><ErrorNotice message={begin.error.message} /></div> : null}
      {setup ? <div className="mt-6 grid gap-5 border-t border-slate-100 pt-6"><div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Antes de continuar:</strong> adicione a chave ao seu aplicativo autenticador. Ela será substituída se você reiniciar esta configuração.<div className="mt-3 flex flex-wrap items-center gap-2"><code className="break-all rounded-lg bg-white px-3 py-2 text-xs">{setup.secret}</code><Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(setup.secret)}><Copy size={14} /> Copiar</Button></div></div><Field label="Código de seis números"><Input className="max-w-56 text-center text-xl tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/gu, ""))} /></Field>{confirm.error ? <ErrorNotice message={confirm.error.message} /> : null}<Button className="w-fit" disabled={code.length !== 6 || confirm.isPending} onClick={() => confirm.mutate()}>{confirm.isPending ? "Verificando…" : "Confirmar e ativar"}</Button></div> : null}
    </Card>
  </Page>;
}
