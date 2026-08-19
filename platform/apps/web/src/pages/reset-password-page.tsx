import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { AuthShell } from "@/auth/auth-shell";
import { ErrorNotice, SuccessNotice } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

const password = z.string().min(12, "Use pelo menos 12 caracteres").regex(/[a-z]/, "Inclua uma letra minúscula").regex(/[A-Z]/, "Inclua uma letra maiúscula").regex(/\d/, "Inclua um número").regex(/[^A-Za-z0-9]/, "Inclua um caractere especial");
const schema = z.object({ password, confirmation: z.string() }).refine((value) => value.password === value.confirmation, { path: ["confirmation"], message: "As senhas não coincidem" });
type Values = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: "", confirmation: "" } });
  const reset = useMutation({
    mutationFn: async (values: Values) => apiRequest("/v1/auth/password/reset", { method: "POST", body: JSON.stringify({ token, password: values.password }) }),
    onSuccess: () => navigate("/redefinir-senha", { replace: true }),
  });

  return (
    <AuthShell title="Crie uma nova senha" description="O link só pode ser usado uma vez e encerra todas as sessões anteriores.">
      {reset.isSuccess ? (
        <div className="grid gap-5"><SuccessNotice message="Senha alterada. Todas as sessões anteriores foram encerradas." /><Link className="text-center text-sm font-semibold text-brand-800 hover:underline" to="/entrar">Entrar com a nova senha</Link></div>
      ) : !token ? <ErrorNotice message="Este link não contém um token de redefinição." /> : (
        <form className="grid gap-5" onSubmit={(event) => void form.handleSubmit((values) => reset.mutateAsync(values))(event)}>
          <Field label="Nova senha" error={form.formState.errors.password?.message}><Input autoComplete="new-password" type="password" placeholder="Pelo menos 12 caracteres" {...form.register("password")} /></Field>
          <Field label="Confirme a nova senha" error={form.formState.errors.confirmation?.message}><Input autoComplete="new-password" type="password" placeholder="Repita a nova senha" {...form.register("confirmation")} /></Field>
          {reset.error ? <ErrorNotice message={reset.error.message} /> : null}
          <Button type="submit" disabled={!token || reset.isPending}><KeyRound size={17} />{reset.isPending ? "Salvando…" : "Salvar nova senha"}</Button>
        </form>
      )}
    </AuthShell>
  );
}
