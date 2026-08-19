import { useMutation } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell } from "@/auth/auth-shell";
import { ErrorNotice, SuccessNotice } from "@/components/page";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const confirm = useMutation({
    mutationFn: async () => apiRequest("/v1/auth/email/confirm", { method: "POST", body: JSON.stringify({ token }) }),
    onSuccess: () => navigate("/verificar-email", { replace: true }),
  });

  return (
    <AuthShell title="Confirme seu e-mail" description="A confirmação protege sua conta e habilita comunicações transacionais.">
      {confirm.isSuccess ? (
        <div className="grid gap-5"><SuccessNotice message="E-mail confirmado com sucesso." /><Link className="text-center text-sm font-semibold text-brand-800 hover:underline" to="/entrar">Ir para o login</Link></div>
      ) : !token ? <ErrorNotice message="Este link não contém um token de verificação." /> : (
        <div className="grid gap-5">{confirm.error ? <ErrorNotice message={confirm.error.message} /> : null}<Button disabled={confirm.isPending} onClick={() => confirm.mutate()}><MailCheck size={17} />{confirm.isPending ? "Confirmando…" : "Confirmar e-mail"}</Button></div>
      )}
    </AuthShell>
  );
}
