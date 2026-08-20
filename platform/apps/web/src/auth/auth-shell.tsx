import { useQuery } from "@tanstack/react-query";
import { CircleAlert, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({ children, title, description, backendUnavailableAction }: { children: ReactNode; title: string; description: string; backendUnavailableAction?: ReactNode }) {
  const service = useQuery({
    queryKey: ["api-readiness"],
    queryFn: async () => {
      const response = await fetch("/health/ready", { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error("API indisponível");
      return response.json() as Promise<{ status: string }>;
    },
    retry: false,
    staleTime: 60_000,
  });

  return (
    <main className="grid min-h-screen bg-app-canvas lg:grid-cols-[minmax(340px,0.85fr)_minmax(520px,1.15fr)]">
      <section className="relative hidden overflow-hidden bg-brand-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-24 top-28 size-80 rounded-full bg-brand-400/10 blur-3xl" />
        <div className="absolute -right-24 bottom-10 size-72 rounded-full bg-teal-300/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-brand bg-brand-500 text-white shadow-brand">
            <Sparkles size={22} />
          </span>
          <div>
            <strong className="block text-xl tracking-tight">AtendeIA</strong>
            <span className="text-xs text-brand-100/60">Central inteligente</span>
          </div>
        </div>

        <div className="relative max-w-md">
          <span className="mb-6 grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/5">
            <MessageCircle size={28} />
          </span>
          <h2 className="text-4xl font-semibold leading-tight tracking-[-0.045em]">
            Atendimento humano quando precisa. Inteligente sempre.
          </h2>
          <p className="mt-5 max-w-sm text-sm leading-7 text-brand-50/65">
            Organize o WhatsApp da sua empresa, ensine sua IA e acompanhe cada conversa em um só lugar.
          </p>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-brand-50/55">
          <ShieldCheck size={16} />
          Seus dados ficam separados e protegidos por empresa.
        </div>
      </section>

      <section className="flex min-w-0 items-center justify-center p-4 min-[360px]:p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden sm:mb-8">
            <span className="inline-flex items-center gap-2 text-lg font-bold text-brand-900">
              <Sparkles className="rounded-lg bg-brand-700 p-1.5 text-white" size={30} /> AtendeIA
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          {service.isError ? (
            <div className="mt-5 flex items-start gap-3 rounded-brand border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900 sm:mt-6 sm:p-4" role="status">
              <CircleAlert className="mt-0.5 shrink-0" size={18} />
              <div className="min-w-0 flex-1">
                <p><strong>Serviço temporariamente indisponível.</strong> A API, o banco e as filas precisam estar publicados para entrar ou criar uma conta.</p>
                {backendUnavailableAction ? <div className="mt-3">{backendUnavailableAction}</div> : <p className="mt-1 text-xs">Nenhuma operação será simulada.</p>}
              </div>
            </div>
          ) : null}
          <div className="mt-6 sm:mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
