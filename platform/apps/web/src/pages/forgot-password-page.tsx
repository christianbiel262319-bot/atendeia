import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleAlert, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { AuthShell } from "@/auth/auth-shell";
import { ErrorNotice, SuccessNotice } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

const schema = z.object({ email: z.email("Informe um e-mail válido") });
type Values = z.infer<typeof schema>;
type Capabilities = { emailDelivery: boolean };

export function ForgotPasswordPage() {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "" } });
  const capabilities = useQuery({
    queryKey: ["auth-capabilities"],
    queryFn: async () => (await apiRequest<{ data: Capabilities }>("/v1/auth/capabilities")).data,
    retry: false,
  });
  const request = useMutation({
    mutationFn: async (values: Values) => apiRequest("/v1/auth/password/forgot", { method: "POST", body: JSON.stringify(values) }),
  });
  const configured = capabilities.data?.emailDelivery !== false;

  return (
    <AuthShell title="Recupere seu acesso" description="Solicite um link de uso único para criar uma nova senha.">
      {!capabilities.isLoading && !configured ? (
        <div className="mb-5 flex items-start gap-3 rounded-brand border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <CircleAlert className="mt-0.5 shrink-0" size={18} />
          <span><strong>Configuração necessária.</strong> O envio de e-mail ainda não foi configurado no servidor.</span>
        </div>
      ) : null}
      {request.isSuccess ? (
        <div className="grid gap-5">
          <SuccessNotice message="Se houver uma conta elegível e o envio estiver disponível, o link chegará ao e-mail informado. Ele expira em 30 minutos." />
          <Link className="text-center text-sm font-semibold text-brand-800 hover:underline" to="/entrar">Voltar para o login</Link>
        </div>
      ) : (
        <form className="grid gap-5" onSubmit={(event) => void form.handleSubmit((values) => request.mutateAsync(values))(event)}>
          <Field label="E-mail da conta" error={form.formState.errors.email?.message}>
            <Input autoComplete="email" inputMode="email" placeholder="voce@empresa.com" {...form.register("email")} />
          </Field>
          {request.error ? <ErrorNotice message={request.error.message} /> : null}
          <Button type="submit" disabled={request.isPending || capabilities.isLoading || !configured}>
            <Mail size={17} />{request.isPending ? "Solicitando…" : !configured ? "Configuração necessária" : "Enviar link seguro"}
          </Button>
          <Link className="text-center text-sm font-semibold text-brand-800 hover:underline" to="/entrar">Voltar para o login</Link>
        </form>
      )}
    </AuthShell>
  );
}
