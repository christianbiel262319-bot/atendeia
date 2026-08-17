import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  CreditCard,
  Inbox,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  ServerCog,
  Sparkles,
  Users,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { to: "/", label: "Visão geral", icon: BarChart3 },
  { to: "/atendimentos", label: "Atendimentos", icon: Inbox },
  { to: "/contatos", label: "Contatos", icon: UserRound },
  { to: "/conhecimento", label: "Conhecimento", icon: BookOpen },
  { to: "/automacao", label: "Automação", icon: Bot },
  { to: "/equipe", label: "Equipe", icon: Users },
  { to: "/planos", label: "Planos e cobrança", icon: CreditCard },
];

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const visibleNavigation = profile?.user.isSuperAdmin
    ? [...navigation, { to: "/super-admin", label: "Super Admin", icon: ServerCog }]
    : navigation;

  return (
    <div className="min-h-screen bg-[#f5f7f5] text-slate-900">
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#0f3024] text-white transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-[74px] items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-500"><Sparkles size={20} /></span>
            <div><strong className="block tracking-tight">AtendeIA</strong><span className="text-[10px] text-emerald-100/55">Central inteligente</span></div>
          </div>
          <button className="grid size-9 place-items-center rounded-lg text-emerald-100/70 lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={20} /></button>
        </div>
        <nav className="grid gap-1 px-3 py-5" aria-label="Navegação principal">
          <span className="px-3 pb-2 text-[10px] font-bold tracking-[0.15em] text-emerald-100/40">WORKSPACE</span>
          {visibleNavigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) => cn("flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-emerald-50/65 transition hover:bg-white/5 hover:text-white", isActive && "bg-white/10 text-white")}
            >
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1" />
        <div className="m-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-xs font-bold text-emerald-900">
              {initials(profile?.tenant.name ?? "Empresa")}
            </span>
            <div className="min-w-0 flex-1"><strong className="block truncate text-xs">{profile?.tenant.name}</strong><span className="block truncate text-[10px] text-emerald-100/45">{profile?.user.email}</span></div>
            <Link className="grid size-8 place-items-center rounded-lg text-emerald-100/45 hover:bg-white/10 hover:text-white" to="/configuracoes" aria-label="Configurações"><Settings size={16} /></Link>
          </div>
          <button className="mt-3 flex w-full items-center gap-2 border-t border-white/10 pt-3 text-xs text-emerald-50/55 hover:text-white" onClick={() => void signOut()}>
            <LogOut size={15} /> Sair com segurança
          </button>
        </div>
      </aside>

      {open ? <button className="fixed inset-0 z-30 bg-emerald-950/40 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu" /> : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-[74px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <button className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-600 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button>
            <label className="hidden h-10 w-80 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-400 md:flex">
              <MessageCircle size={17} /><input className="w-full bg-transparent text-sm outline-none" placeholder="Pesquisar no AtendeIA" aria-label="Pesquisar" />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600" aria-label="Notificações"><Bell size={18} /></button>
            <Button size="sm"><MessageCircle size={16} /> <span className="hidden sm:inline">Configurar atendimento</span></Button>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}

function initials(value: string): string {
  return value.split(/\s+/u).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}
