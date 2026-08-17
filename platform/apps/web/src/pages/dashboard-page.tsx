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
    <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-7 lg:p-9">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><span className="text-[10px] font-bold tracking-[0.16em] text-slate-400">VISÃO GERAL</span><h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-slate-900">Olá, {firstName(profile?.user.fullName)}</h1><p className="mt-2 text-sm text-slate-500">Prepare os pontos essenciais para colocar sua IA no WhatsApp.</p></div>
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"><span className="size-2 rounded-full bg-amber-500" />{data?.whatsapp ? "WhatsApp configurado" : "WhatsApp não conectado"}</span>
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-5">
          <div><span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><Sparkles size={14} /> Primeiros passos</span><h2 className="mt-2 text-lg font-semibold">Prepare seu atendimento</h2><p className="mt-1 text-xs text-slate-500">Complete as quatro etapas para ativar o AtendeIA.</p></div>
          <div className="text-right text-xs"><strong className="block text-slate-700">{completeSteps} de 4</strong><span className="mt-1 block text-[10px] text-slate-400">{completeSteps * 25}% concluído</span></div>
        </div>
        <div className="my-5 h-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${completeSteps * 25}%` }} /></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {setupSteps.map(({ title, description, to, action, icon: Icon }, index) => (
            <article key={title} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm">
              <div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon size={18} /></span><span className="text-[10px] font-bold text-slate-300">0{index + 1}</span></div>
              <h3 className="mt-4 text-sm font-semibold text-slate-800">{title}</h3><p className="mt-1 min-h-10 text-[11px] leading-5 text-slate-500">{description}</p>
              <Link className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700" to={to}>{action}<ArrowRight size={14} /></Link>
            </article>
          ))}
        </div>
      </Card>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Atendimentos" value={data?.conversations} icon={Headphones} />
        <Metric title="Mensagens" value={data?.messages} icon={MessageCircle} />
        <Metric title="Aguardando humano" value={data?.waitingHuman} icon={Inbox} />
        <Metric title="Pessoas na equipe" value={data?.members} icon={Users} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <Card className="p-5 sm:p-6"><span className="text-[10px] font-bold tracking-[0.15em] text-slate-400">CANAL PRINCIPAL</span><h2 className="mt-2 text-lg font-semibold">Estado do WhatsApp</h2><div className="mt-5 flex min-h-40 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center sm:flex-row sm:text-left"><span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><MessageCircle size={27} /></span><div className="flex-1"><h3 className="text-sm font-semibold">{data?.whatsapp ? "Canal configurado" : "Seu número ainda não está conectado"}</h3><p className="mt-1 text-xs leading-5 text-slate-500">Use somente a API oficial da Meta para receber e responder mensagens com segurança.</p></div><Link className="inline-flex h-9 items-center rounded-xl bg-emerald-800 px-3 text-xs font-semibold text-white hover:bg-emerald-900" to="/automacao">Configurar depois</Link></div></Card>
        <Card className="p-5 sm:p-6"><span className="text-[10px] font-bold tracking-[0.15em] text-slate-400">TEMPO REAL</span><h2 className="mt-2 text-lg font-semibold">Atividade recente</h2><div className="flex min-h-40 flex-col items-center justify-center text-center"><span className="grid size-12 place-items-center rounded-2xl border border-slate-200 text-slate-400"><Inbox size={22} /></span><h3 className="mt-4 text-sm font-semibold">Nenhuma atividade ainda</h3><p className="mt-1 max-w-56 text-xs leading-5 text-slate-500">Novas conversas e ações da equipe aparecerão aqui.</p></div></Card>
      </section>
    </main>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: number | undefined; icon: typeof Headphones }) {
  return <Card className="flex items-center gap-4 p-4"><span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon size={19} /></span><div><span className="block text-xs font-medium text-slate-500">{title}</span><strong className="mt-1 block text-xl tracking-tight">{value ?? "—"}</strong></div></Card>;
}

function firstName(value?: string): string {
  return value?.trim().split(/\s+/u)[0] || "bem-vindo";
}
