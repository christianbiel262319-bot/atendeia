import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Headphones,
  Inbox,
  MessageCircle,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/auth-provider";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";

type Summary = {
  conversations: number;
  messages: number;
  waitingHuman: number;
  members: number;
  whatsapp: { status: string; displayPhoneNumber: string | null } | null;
  onboarding: {
    steps: { whatsapp: boolean; knowledge: boolean; ai: boolean; team: boolean };
    completed: number;
    total: number;
  };
};

const setupSteps = [
  { title: "Conecte seu WhatsApp", description: "Vincule seu número oficial pela API da Meta.", to: "/automacao", action: "Conectar", icon: MessageCircle },
  { title: "Adicione conhecimento", description: "Cadastre produtos, serviços, horários e dúvidas.", to: "/conhecimento", action: "Cadastrar", icon: BookOpen },
  { title: "Configure a IA", description: "Defina o tom e as regras do seu atendimento.", to: "/automacao", action: "Configurar", icon: Bot },
  { title: "Convide sua equipe", description: "Prepare as transferências para atendimento humano.", to: "/equipe", action: "Convidar", icon: Users },
];

export function DashboardPage() {
  const { profile } = useAuth();
  const summary = useQuery({
    queryKey: ["dashboard-summary", profile?.tenant.id],
    queryFn: async () => (await apiRequest<{ data: Summary }>("/v1/dashboard/summary", { authenticated: true })).data,
  });
  const data = summary.data;
  const completeSteps = data?.onboarding.completed ?? 0;

  return (
    <main className="mx-auto w-full min-w-0 max-w-[1500px] px-3 py-4 min-[360px]:px-4 sm:p-7 lg:p-9">
      <div className="mb-5 flex flex-col items-stretch justify-between gap-4 sm:mb-7 sm:flex-row sm:items-end">
        <div className="min-w-0"><span className="text-[10px] font-bold tracking-[0.16em] text-slate-400">VISÃO GERAL</span><h1 className="mt-2 text-[length:var(--font-size-title)] font-semibold tracking-[-0.045em] text-slate-900">Olá, {firstName(profile?.user.fullName)}</h1><p className="mt-2 text-sm leading-6 text-slate-500">Prepare os pontos essenciais para colocar sua IA no WhatsApp.</p></div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"><span className="size-2 rounded-full bg-amber-500" />{data?.whatsapp ? "WhatsApp configurado" : "WhatsApp não conectado"}</span>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 sm:gap-5">
          <div className="min-w-0"><span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><Sparkles size={14} /> Primeiros passos</span><h2 className="mt-2 text-base font-semibold sm:text-lg">Prepare seu atendimento</h2><p className="mt-1 text-xs leading-5 text-slate-500">Complete as quatro etapas para ativar o AtendeIA.</p></div>
          <div className="text-right text-xs"><strong className="block text-slate-700">{completeSteps} de 4</strong><span className="mt-1 block text-[10px] text-slate-400">{completeSteps * 25}% concluído</span></div>
        </div>
        <div className="my-5 h-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${completeSteps * 25}%` }} /></div>
        <div className="grid gap-3 min-[390px]:grid-cols-2 xl:grid-cols-4">
          {setupSteps.map(({ title, description, to, action, icon: Icon }, index) => (
            <article key={title} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm sm:p-4">
              <div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon size={18} /></span><span className="text-[10px] font-bold text-slate-300">0{index + 1}</span></div>
              <h3 className="mt-3 text-sm font-semibold text-slate-800 sm:mt-4">{title}</h3><p className="mt-1 text-[11px] leading-5 text-slate-500 sm:min-h-10">{description}</p>
              <Link className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700" to={to}>{action}<ArrowRight size={14} /></Link>
            </article>
          ))}
        </div>
      </Card>

      <section className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric title="Atendimentos" value={data?.conversations} icon={Headphones} />
        <Metric title="Mensagens" value={data?.messages} icon={MessageCircle} />
        <Metric title="Aguardando humano" value={data?.waitingHuman} icon={Inbox} />
        <Metric title="Pessoas na equipe" value={data?.members} icon={Users} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <Card className="p-4 sm:p-6"><span className="text-[10px] font-bold tracking-[0.15em] text-slate-400">CANAL PRINCIPAL</span><h2 className="mt-2 text-lg font-semibold">Estado do WhatsApp</h2><div className="mt-4 flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center sm:mt-5 sm:min-h-40 sm:flex-row sm:p-6 sm:text-left"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 sm:size-14"><MessageCircle size={27} /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{data?.whatsapp ? "Canal configurado" : "Seu número ainda não está conectado"}</h3><p className="mt-1 text-xs leading-5 text-slate-500">Use somente a API oficial da Meta para receber e responder mensagens com segurança.</p></div><Link className="inline-flex h-9 w-full items-center justify-center rounded-xl bg-emerald-800 px-3 text-xs font-semibold text-white hover:bg-emerald-900 sm:w-auto" to="/automacao">Configurar depois</Link></div></Card>
        <Card className="p-4 sm:p-6"><span className="text-[10px] font-bold tracking-[0.15em] text-slate-400">TEMPO REAL</span><h2 className="mt-2 text-lg font-semibold">Atividade recente</h2><div className="flex min-h-32 flex-col items-center justify-center text-center sm:min-h-40"><span className="grid size-12 place-items-center rounded-2xl border border-slate-200 text-slate-400"><Inbox size={22} /></span><h3 className="mt-4 text-sm font-semibold">Nenhuma atividade ainda</h3><p className="mt-1 max-w-56 text-xs leading-5 text-slate-500">Novas conversas e ações da equipe aparecerão aqui.</p></div></Card>
      </section>
    </main>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: number | undefined; icon: typeof Headphones }) {
  return <Card className="flex min-w-0 items-center gap-2 p-3 min-[390px]:gap-3 sm:gap-4 sm:p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 sm:size-10"><Icon size={18} /></span><div className="min-w-0"><span className="block text-[11px] font-medium leading-4 text-slate-500 sm:text-xs">{title}</span><strong className="mt-1 block text-lg tracking-tight sm:text-xl">{value ?? "—"}</strong></div></Card>;
}

function firstName(value?: string): string {
  return value?.trim().split(/\s+/u)[0] || "bem-vindo";
}
