import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, MailCheck } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorNotice, Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const accept = useMutation({ mutationFn: async () => apiRequest("/v1/team/invitations/accept", { method: "POST", authenticated: true, body: JSON.stringify({ token }) }) });
  return <Page width="max-w-xl"><Card className="mt-14 p-7 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">{accept.isSuccess ? <CheckCircle2 size={25} /> : <MailCheck size={25} />}</span><h1 className="mt-5 text-2xl font-semibold">{accept.isSuccess ? "Convite aceito" : "Entrar na equipe"}</h1><p className="mt-2 text-sm leading-6 text-slate-500">{accept.isSuccess ? "A empresa foi vinculada à sua conta. Saia e entre novamente para selecioná-la." : "Confirme o convite usando a conta com o mesmo e-mail do destinatário."}</p>{!token ? <div className="mt-5"><ErrorNotice message="Este link não contém um token de convite." /></div> : null}{accept.error ? <div className="mt-5"><ErrorNotice message={accept.error.message} /></div> : null}<div className="mt-6 flex justify-center gap-3">{!accept.isSuccess ? <Button disabled={!token || accept.isPending} onClick={() => accept.mutate()}>{accept.isPending ? "Confirmando…" : "Aceitar convite"}</Button> : null}<Link className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700" to="/">Voltar</Link></div></Card></Page>;
}
