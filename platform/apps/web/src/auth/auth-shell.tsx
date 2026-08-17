import { MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({ children, title, description }: { children: ReactNode; title: string; description: string }) {
  return (
    <main className="grid min-h-screen bg-[#f4f7f5] lg:grid-cols-[minmax(340px,0.85fr)_minmax(520px,1.15fr)]">
      <section className="relative hidden overflow-hidden bg-[#0f3024] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-24 top-28 size-80 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute -right-24 bottom-10 size-72 rounded-full bg-teal-300/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-950/20">
            <Sparkles size={22} />
          </span>
          <div>
            <strong className="block text-xl tracking-tight">AtendeIA</strong>
            <span className="text-xs text-emerald-100/60">Central inteligente</span>
          </div>
        </div>

        <div className="relative max-w-md">
          <span className="mb-6 grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/5">
            <MessageCircle size={28} />
          </span>
          <h2 className="text-4xl font-semibold leading-tight tracking-[-0.045em]">
            Atendimento humano quando precisa. Inteligente sempre.
          </h2>
          <p className="mt-5 max-w-sm text-sm leading-7 text-emerald-50/65">
            Organize o WhatsApp da sua empresa, ensine sua IA e acompanhe cada conversa em um só lugar.
          </p>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-emerald-50/55">
          <ShieldCheck size={16} />
          Seus dados ficam separados e protegidos por empresa.
        </div>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <span className="inline-flex items-center gap-2 text-lg font-bold text-emerald-900">
              <Sparkles className="rounded-lg bg-emerald-700 p-1.5 text-white" size={30} /> AtendeIA
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-900">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
