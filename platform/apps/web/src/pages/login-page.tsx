import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Building2, KeyRound, MonitorPlay } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/auth/auth-provider";
import { AuthShell } from "@/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { demoModeAvailable } from "@/demo/demo-mode";

const schema = z.object({
  email: z.email("Informe um e-mail válido"),
  password: z.string().min(1, "Informe sua senha"),
});

type FormValues = z.infer<typeof schema>;
type Stage =
  | { type: "credentials" }
  | { type: "tenant"; tenants: Array<{ id: string; name: string }>; values: FormValues }
  | { type: "mfa"; challengeToken: string };

export function LoginPage() {
  const { profile, enterDemo, signIn, verifyMfa } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get("convite");
  const [stage, setStage] = useState<Stage>({ type: "credentials" });
  const [mfaCode, setMfaCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (profile) return <Navigate to={afterLoginPath(invitationToken)} replace />;

  async function handleCredentials(values: FormValues): Promise<void> {
    setSubmitting(true);
    setServerError(null);
    try {
      const result = await signIn(values);
      if (result.type === "done") void navigate(afterLoginPath(invitationToken), { replace: true });
      if (result.type === "mfa") setStage(result);
      if (result.type === "tenant") setStage({ ...result, values });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Não foi possível entrar");
    } finally {
      setSubmitting(false);
    }
  }

  async function chooseTenant(tenantId: string): Promise<void> {
    if (stage.type !== "tenant") return;
    setSubmitting(true);
    setServerError(null);
    try {
      const result = await signIn({ ...stage.values, tenantId });
      if (result.type === "done") void navigate(afterLoginPath(invitationToken), { replace: true });
      if (result.type === "mfa") setStage(result);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Não foi possível abrir a empresa");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMfa(): Promise<void> {
    if (stage.type !== "mfa" || !/^\d{6}$/.test(mfaCode)) return;
    setSubmitting(true);
    setServerError(null);
    try {
      await verifyMfa({ challengeToken: stage.challengeToken, code: mfaCode });
      void navigate(afterLoginPath(invitationToken), { replace: true });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Código inválido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Bem-vindo de volta"
      description="Entre para continuar administrando o atendimento da sua empresa."
      backendUnavailableAction={demoModeAvailable ? (
        <Button type="button" variant="outline" className="w-full border-amber-300 bg-white text-amber-950 hover:bg-amber-100" onClick={enterDemo}>
          <MonitorPlay size={17} /> Entrar no modo demonstração
        </Button>
      ) : undefined}
    >
      {stage.type === "credentials" ? (
        <form className="grid gap-5" onSubmit={(event) => void form.handleSubmit(handleCredentials)(event)}>
          <Field label="E-mail" error={form.formState.errors.email?.message}>
            <Input autoComplete="email" inputMode="email" placeholder="voce@empresa.com" {...form.register("email")} />
          </Field>
          <Field label="Senha" error={form.formState.errors.password?.message}>
            <Input autoComplete="current-password" type="password" placeholder="Sua senha" {...form.register("password")} />
          </Field>
          <Link className="-mt-2 justify-self-end text-xs font-semibold text-brand-800 hover:underline" to="/esqueci-senha">Esqueci minha senha</Link>
          {serverError ? <ErrorMessage>{serverError}</ErrorMessage> : null}
          <Button className="mt-1 w-full" type="submit" disabled={submitting}>
            {submitting ? "Entrando…" : "Entrar"} <ArrowRight size={17} />
          </Button>
        </form>
      ) : null}

      {stage.type === "tenant" ? (
        <div className="grid gap-3">
          <div className="mb-2 flex items-center gap-3 rounded-brand border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">
            <Building2 size={20} /> Escolha a empresa que deseja abrir.
          </div>
          {stage.tenants.map((tenant) => (
            <Button key={tenant.id} variant="outline" className="h-14 justify-between" onClick={() => void chooseTenant(tenant.id)} disabled={submitting}>
              {tenant.name} <ArrowRight size={17} />
            </Button>
          ))}
          {serverError ? <ErrorMessage>{serverError}</ErrorMessage> : null}
        </div>
      ) : null}

      {stage.type === "mfa" ? (
        <div className="grid gap-5">
          <div className="flex items-start gap-3 rounded-brand border border-brand-100 bg-brand-50 p-4 text-sm leading-6 text-brand-900">
            <KeyRound className="mt-0.5 shrink-0" size={19} />
            Digite o código de seis números do seu aplicativo autenticador.
          </div>
          <Field label="Código de segurança">
            <Input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              className="text-center text-xl tracking-[0.35em]"
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value.replace(/\D/gu, ""))}
            />
          </Field>
          {serverError ? <ErrorMessage>{serverError}</ErrorMessage> : null}
          <Button className="w-full" disabled={submitting || mfaCode.length !== 6} onClick={() => void handleMfa()}>
            {submitting ? "Verificando…" : "Verificar e entrar"}
          </Button>
        </div>
      ) : null}

      <p className="mt-7 text-center text-sm text-slate-500">
        Ainda não tem conta? <Link className="font-semibold text-brand-800 hover:underline" to="/criar-conta">Criar conta</Link>
      </p>
    </AuthShell>
  );
}

function ErrorMessage({ children }: { children: string }) {
  return <p role="alert" className="rounded-brand border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{children}</p>;
}

function afterLoginPath(invitationToken: string | null): string {
  return invitationToken ? `/convite?token=${encodeURIComponent(invitationToken)}` : "/";
}
