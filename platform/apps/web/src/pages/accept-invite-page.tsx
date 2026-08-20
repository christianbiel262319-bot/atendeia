import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/auth/auth-provider";
import { ErrorNotice, LoadingState, Page, SuccessNotice } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

const password = z.string().min(12, "Use pelo menos 12 caracteres").regex(/[a-z]/, "Inclua uma letra minúscula").regex(/[A-Z]/, "Inclua uma letra maiúscula").regex(/\d/, "Inclua um número").regex(/[^A-Za-z0-9]/, "Inclua um caractere especial");
const schema = z.object({ fullName: z.string().trim().min(2, "Informe seu nome"), password, confirmation: z.string() }).refine((input) => input.password === input.confirmation, { path: ["confirmation"], message: "As senhas não coincidem" });
type Values = z.infer<typeof schema>;
type Invitation = { tenantName: string; role: string; maskedEmail: string; requiresAccountCreation: boolean };

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const { profile, booting, registerInvitation, signOut } = useAuth();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { fullName: "", password: "", confirmation: "" } });
  const invitation = useQuery({
    queryKey: ["invitation", token],
    enabled: Boolean(token),
    retry: false,
    queryFn: async () => (await apiRequest<{ data: Invitation }>("/v1/auth/invitations/inspect", { method: "POST", body: JSON.stringify({ token }) })).data,
  });
  const accept = useMutation({ mutationFn: async () => apiRequest("/v1/team/invitations/accept", { method: "POST", authenticated: true, body: JSON.stringify({ token }) }) });
  const register = useMutation({
    mutationFn: async (values: Values) => registerInvitation({ token, fullName: values.fullName, password: values.password }),
    onSuccess: () => navigate("/", { replace: true }),
  });

  async function reenter(): Promise<void> {
    await signOut();
    await navigate("/entrar", { replace: true });
  }

  return (
    <Page width="max-w-xl">
      <Card className="mt-8 p-6 text-center sm:mt-14 sm:p-8">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">{accept.isSuccess ? <CheckCircle2 size={25} /> : <MailCheck size={25} />}</span>
        <h1 className="mt-5 text-2xl font-semibold">{accept.isSuccess ? "Convite aceito" : "Entrar na equipe"}</h1>
        {!token ? <div className="mt-5"><ErrorNotice message="Este link não contém um token de convite." /></div> : invitation.isError ? <div className="mt-5"><ErrorNotice message={invitation.error.message} /></div> : invitation.isLoading || booting ? <div className="mt-6 text-left"><LoadingState label="Validando convite" /></div> : invitation.data ? (
          <div className="mt-3">
            <p className="text-sm leading-6 text-slate-500">Você foi convidado para <strong>{invitation.data.tenantName}</strong> como {roleLabel(invitation.data.role)}. Destinatário: {invitation.data.maskedEmail}.</p>
            {accept.isSuccess ? <div className="mt-6 grid gap-4"><SuccessNotice message="A empresa foi vinculada à sua conta. Entre novamente para selecioná-la com uma nova sessão." /><Button onClick={() => void reenter()}>Sair e entrar na empresa</Button></div> : profile ? (
              <div className="mt-6 grid gap-4">{accept.error ? <ErrorNotice message={accept.error.message} /> : null}<Button disabled={accept.isPending} onClick={() => accept.mutate()}>{accept.isPending ? "Confirmando…" : "Aceitar convite com esta conta"}</Button><Link className="text-sm font-semibold text-slate-600 hover:underline" to="/">Voltar</Link></div>
            ) : invitation.data.requiresAccountCreation ? (
              <form className="mt-6 grid gap-4 text-left" onSubmit={(event) => void form.handleSubmit((values) => register.mutate(values))(event)}>
                <Field label="Seu nome" error={form.formState.errors.fullName?.message}><Input autoComplete="name" {...form.register("fullName")} /></Field>
                <Field label="Crie uma senha" error={form.formState.errors.password?.message}><Input autoComplete="new-password" type="password" {...form.register("password")} /></Field>
                <Field label="Confirme a senha" error={form.formState.errors.confirmation?.message}><Input autoComplete="new-password" type="password" {...form.register("confirmation")} /></Field>
                {register.error ? <ErrorNotice message={register.error.message} /> : null}
                <Button type="submit" disabled={register.isPending}>{register.isPending ? "Criando acesso…" : "Criar acesso e entrar"}</Button>
              </form>
            ) : (
              <div className="mt-6 grid gap-3"><p className="text-sm text-slate-500">Este e-mail já possui uma conta. Entre para aceitar o convite.</p><Link className="inline-flex min-h-11 items-center justify-center rounded-brand bg-brand-700 px-5 text-sm font-semibold text-white" to={`/entrar?convite=${encodeURIComponent(token)}`}>Entrar na conta existente</Link></div>
            )}
          </div>
        ) : null}
      </Card>
    </Page>
  );
}

function roleLabel(role: string): string {
  return role === "ADMIN" ? "administrador" : role === "AGENT" ? "atendente" : role.toLowerCase();
}
