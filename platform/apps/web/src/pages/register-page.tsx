import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/auth/auth-provider";
import { AuthShell } from "@/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const schema = z
  .object({
    companyName: z.string().trim().min(2, "Informe o nome da empresa").max(160),
    fullName: z.string().trim().min(2, "Informe seu nome").max(160),
    email: z.email("Informe um e-mail válido"),
    password: z
      .string()
      .min(12, "Use pelo menos 12 caracteres")
      .regex(/[A-Z]/, "Inclua uma letra maiúscula")
      .regex(/[a-z]/, "Inclua uma letra minúscula")
      .regex(/\d/, "Inclua um número")
      .regex(/[^A-Za-z0-9]/, "Inclua um caractere especial"),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem",
  });

type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const { profile, registerAccount } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (profile) return <Navigate to="/" replace />;

  async function submit(values: FormValues): Promise<void> {
    setServerError(null);
    try {
      await registerAccount({
        companyName: values.companyName,
        fullName: values.fullName,
        email: values.email,
        password: values.password,
      });
      void navigate("/", { replace: true });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Não foi possível criar a conta");
    }
  }

  return (
    <AuthShell title="Crie sua empresa" description="Comece a organizar o atendimento. Você poderá conectar o WhatsApp depois.">
      <form className="grid gap-4" onSubmit={(event) => void form.handleSubmit(submit)(event)}>
        <Field label="Nome da empresa" error={form.formState.errors.companyName?.message}>
          <Input autoComplete="organization" placeholder="Nome da sua empresa" {...form.register("companyName")} />
        </Field>
        <Field label="Seu nome" error={form.formState.errors.fullName?.message}>
          <Input autoComplete="name" placeholder="Nome completo" {...form.register("fullName")} />
        </Field>
        <Field label="E-mail" error={form.formState.errors.email?.message}>
          <Input autoComplete="email" inputMode="email" placeholder="voce@empresa.com" {...form.register("email")} />
        </Field>
        <Field label="Senha" error={form.formState.errors.password?.message}>
          <Input autoComplete="new-password" type="password" placeholder="Pelo menos 12 caracteres" {...form.register("password")} />
        </Field>
        <Field label="Confirme a senha" error={form.formState.errors.confirmPassword?.message}>
          <Input autoComplete="new-password" type="password" placeholder="Repita a senha" {...form.register("confirmPassword")} />
        </Field>
        {serverError ? <p role="alert" className="rounded-brand border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{serverError}</p> : null}
        <Button className="mt-2 w-full" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Criando conta…" : "Criar minha conta"} <ArrowRight size={17} />
        </Button>
      </form>
      <p className="mt-7 text-center text-sm text-slate-500">
        Já possui conta? <Link className="font-semibold text-brand-800 hover:underline" to="/entrar">Entrar</Link>
      </p>
    </AuthShell>
  );
}
