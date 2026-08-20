import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  BookOpen,
  Bot,
  Building2,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Inbox,
  Info,
  LogOut,
  Menu,
  MonitorPlay,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ServerCog,
  Settings,
  Sparkles,
  Users,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/auth-provider";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

type NavigationItem = {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  badge?: number | undefined;
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

type DashboardSummary = { waitingHuman: number };

const collapsedStorageKey = "atendeia.sidebar.collapsed";

export function AppLayout() {
  const { profile, isDemoMode, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(collapsedStorageKey) === "true",
  );
  const [supportOpen, setSupportOpen] = useState(false);
  const [demoInfoOpen, setDemoInfoOpen] = useState(false);
  const [companyInfoOpen, setCompanyInfoOpen] = useState(false);
  const summary = useQuery({
    queryKey: ["dashboard-summary", profile?.tenant.id],
    queryFn: async () => (await apiRequest<{ data: DashboardSummary }>("/v1/dashboard/summary", { authenticated: true })).data,
    enabled: Boolean(profile),
  });

  function toggleCollapsed(): void {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(collapsedStorageKey, String(next));
      return next;
    });
  }

  const groups = navigationGroups(summary.data?.waitingHuman ?? 0);
  if (profile?.user.isSuperAdmin) {
    groups.push({
      label: "PLATAFORMA",
      items: [{ to: "/super-admin", label: "Super Admin", icon: ServerCog }],
    });
  }

  return (
    <div className="min-h-screen bg-app-canvas text-app-ink">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[min(296px,86vw)] flex-col border-r border-white/8 bg-brand-950 text-white shadow-sidebar transition-[width,transform] duration-standard lg:translate-x-0",
          collapsed ? "lg:w-[84px]" : "lg:w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Navegação do AtendeIA"
      >
        <div className={cn("flex h-[76px] items-center border-b border-white/8 px-4", collapsed ? "lg:justify-center" : "justify-between")}>
          <Link className="flex min-w-0 items-center gap-3" to="/" onClick={() => setMobileOpen(false)} aria-label="AtendeIA — Dashboard">
            <span className="grid size-10 shrink-0 place-items-center rounded-brand bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-brand"><Sparkles size={20} /></span>
            <span className={cn("min-w-0", collapsed && "lg:hidden")}><strong className="block text-[15px] tracking-[-0.02em]">AtendeIA</strong><span className="mt-0.5 block text-[10px] text-brand-100/50">Central inteligente</span></span>
          </Link>
          <button className="grid size-10 place-items-center rounded-brand text-brand-100/70 transition hover:bg-white/8 hover:text-white lg:hidden" type="button" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X size={20} /></button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Navegação principal">
          {groups.map((group) => (
            <div className="mb-5 last:mb-0" key={group.label}>
              <span className={cn("mb-2 block px-3 text-[9px] font-bold tracking-[0.16em] text-brand-100/35", collapsed && "lg:text-center lg:text-[0]")}>
                {collapsed ? <span className="hidden size-1 rounded-full bg-brand-200/30 lg:inline-block" /> : null}
                <span className={cn(collapsed && "lg:hidden")}>{group.label}</span>
              </span>
              <div className="grid gap-1">
                {group.items.map((item) => (
                  <NavigationLink
                    key={item.to}
                    item={item}
                    collapsed={collapsed}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/8 p-3">
          <button
            className={cn("group relative mb-2 flex h-10 w-full items-center gap-3 rounded-brand px-3 text-xs text-brand-100/60 transition hover:bg-white/7 hover:text-white", collapsed && "lg:justify-center lg:px-0")}
            type="button"
            onClick={() => setSupportOpen(true)}
          >
            <CircleHelp size={17} />
            <span className={cn(collapsed && "lg:hidden")}>Ajuda</span>
            {collapsed ? <SidebarTooltip label="Ajuda" /> : null}
          </button>

          <div className={cn("rounded-[14px] border border-white/9 bg-white/[0.055] p-3", collapsed && "lg:p-2")}>
            <div className={cn("flex items-center gap-3", collapsed && "lg:justify-center")}>
              <span className="grid size-9 shrink-0 place-items-center rounded-brand bg-brand-50 text-[11px] font-bold text-brand-900">
                {initials(profile?.tenant.name ?? "Empresa")}
              </span>
              <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}><strong className="block truncate text-xs">{profile?.tenant.name}</strong><span className="mt-1 block truncate text-[9px] text-brand-100/45">{profile?.user.email}</span></div>
              <Link className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-brand-100/45 transition hover:bg-white/10 hover:text-white", collapsed && "lg:hidden")} to="/configuracoes" aria-label="Configurações"><Settings size={15} /></Link>
            </div>
            <button className={cn("group relative mt-3 flex w-full items-center gap-2 border-t border-white/10 pt-3 text-xs text-brand-50/55 transition hover:text-white", collapsed && "lg:justify-center")} type="button" onClick={() => void signOut()}>
              <LogOut size={15} /> <span className={cn(collapsed && "lg:hidden")}>{isDemoMode ? "Sair da demonstração" : "Sair com segurança"}</span>
              {collapsed ? <SidebarTooltip label="Sair" /> : null}
            </button>
          </div>
        </div>

        <button
          className="absolute -right-4 top-[92px] hidden size-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-brand-200 hover:text-brand-700 lg:grid"
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
          title={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </aside>

      {mobileOpen ? <button className="fixed inset-0 z-30 bg-brand-950/45 backdrop-blur-[2px] lg:hidden" type="button" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" /> : null}

      <div className={cn("transition-[padding] duration-standard", collapsed ? "lg:pl-[84px]" : "lg:pl-64")}>
        <header className="sticky top-0 z-20 grid h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-app-line bg-white/92 px-3 backdrop-blur-xl min-[360px]:gap-3 min-[360px]:px-4 sm:h-[76px] sm:px-7">
          <button className="grid size-10 shrink-0 place-items-center rounded-brand border border-app-line text-slate-600 transition hover:bg-slate-50 lg:hidden" type="button" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button>
          <button className="group min-w-0 text-left lg:col-start-1" type="button" onClick={() => setCompanyInfoOpen(true)} aria-label={`Empresa ativa: ${profile?.tenant.name}. Abrir detalhes.`}>
            <span className="hidden text-[9px] font-bold tracking-[0.14em] text-slate-400 sm:block">EMPRESA ATIVA</span>
            <strong className="block truncate text-sm text-slate-700 group-hover:text-brand-800 sm:mt-1">{profile?.tenant.name}</strong>
            {isDemoMode ? <span className="mt-0.5 flex items-center gap-1 text-[9px] font-bold tracking-wide text-amber-700 sm:hidden"><MonitorPlay size={10} /> MODO DEMONSTRAÇÃO</span> : null}
          </button>
          <div className="flex items-center justify-end gap-2 sm:gap-3 lg:col-start-3">
            {isDemoMode ? <button className="hidden min-h-9 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 text-[10px] font-bold tracking-wide text-amber-900 sm:inline-flex" type="button" onClick={() => setDemoInfoOpen(true)} aria-label="Modo demonstração ativo. Abrir informações."><MonitorPlay size={14} />MODO DEMONSTRAÇÃO</button> : null}
            <QuickCreateMenu role={profile?.role ?? "AGENT"} />
          </div>
        </header>
        {isDemoMode ? <div className="flex min-h-8 items-center justify-center gap-2 border-b border-amber-200 bg-amber-50/90 px-3 py-1 text-center text-[10px] font-medium leading-4 text-amber-900 sm:px-7" role="status"><strong>Dados DEMO</strong><span aria-hidden="true">·</span><span className="hidden min-[390px]:inline">nenhuma alteração é real</span><button className="inline-flex min-h-7 items-center gap-1 rounded-lg px-1.5 font-bold underline-offset-2 hover:bg-amber-100 hover:underline" type="button" onClick={() => setDemoInfoOpen(true)}><Info size={12} /> Entenda</button></div> : null}
        <Outlet />
      </div>

      <SupportDialog open={supportOpen} onClose={() => setSupportOpen(false)} />
      <DemoInfoDialog open={demoInfoOpen} onClose={() => setDemoInfoOpen(false)} />
      <CompanyInfoDialog name={profile?.tenant.name ?? "Empresa"} email={profile?.user.email ?? ""} open={companyInfoOpen} onClose={() => setCompanyInfoOpen(false)} />
    </div>
  );
}

export function navigationGroups(waitingHuman: number): NavigationGroup[] {
  return [
    { label: "VISÃO GERAL", items: [{ to: "/", label: "Dashboard", icon: BarChart3 }] },
    {
      label: "ATENDIMENTO",
      items: [
        { to: "/atendimentos", label: "Conversas", icon: Inbox, ...(waitingHuman > 0 ? { badge: waitingHuman } : {}) },
        { to: "/contatos", label: "Contatos", icon: UserRound },
      ],
    },
    {
      label: "INTELIGÊNCIA",
      items: [
        { to: "/conhecimento", label: "Conhecimento", icon: BookOpen },
        { to: "/automacao", label: "Automação / IA", icon: Bot },
      ],
    },
    {
      label: "GESTÃO",
      items: [
        { to: "/equipe", label: "Equipe", icon: Users },
        { to: "/planos", label: "Planos e cobrança", icon: CreditCard },
      ],
    },
    { label: "SISTEMA", items: [{ to: "/configuracoes", label: "Configurações", icon: Settings }] },
  ];
}

function NavigationLink({ item, collapsed, onNavigate }: { item: NavigationItem; collapsed: boolean; onNavigate: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) => cn(
        "group relative flex min-h-11 items-center gap-3 rounded-brand px-3 text-[13px] font-medium text-brand-50/62 transition duration-fast hover:bg-white/[0.065] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300/70",
        collapsed && "lg:justify-center lg:px-0",
        isActive && "bg-white/10 text-white shadow-inner-soft before:absolute before:left-0 before:h-5 before:w-0.5 before:rounded-r-full before:bg-brand-300",
      )}
    >
      <Icon size={18} strokeWidth={1.9} />
      <span className={cn("truncate", collapsed && "lg:hidden")}>{item.label}</span>
      {item.badge ? <span className={cn("ml-auto inline-grid min-w-5 place-items-center rounded-full bg-brand-400/18 px-1.5 py-0.5 text-[9px] font-bold text-brand-100", collapsed && "lg:absolute lg:right-1.5 lg:top-1")}>{item.badge > 99 ? "99+" : item.badge}</span> : null}
      {collapsed ? <SidebarTooltip label={item.label} /> : null}
    </NavLink>
  );
}

function SidebarTooltip({ label }: { label: string }) {
  return <span role="tooltip" className="pointer-events-none absolute left-[calc(100%+12px)] z-50 hidden whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100 lg:block">{label}</span>;
}

function QuickCreateMenu({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const { canCreateContact, canCreateKnowledge, canInvite } = quickCreatePermissions(role);

  useEffect(() => {
    function closeOnOutside(event: MouseEvent): void {
      if (container.current && !container.current.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  if (!canCreateContact && !canCreateKnowledge && !canInvite) return null;

  return (
    <div className="relative" ref={container}>
      <Button className="size-10 px-0 sm:w-auto sm:px-3" size="sm" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-haspopup="menu" aria-label="Abrir criação rápida">
        <Plus size={16} /><span className="hidden sm:inline">Criar</span>
      </Button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden rounded-[15px] border border-app-line bg-white p-2 shadow-popover" role="menu" aria-label="Criação rápida">
          <div className="px-3 pb-2 pt-1"><span className="text-[9px] font-bold tracking-[0.14em] text-slate-400">CRIAÇÃO RÁPIDA</span><p className="mt-1 text-[11px] text-slate-500">Somente ações permitidas para seu perfil.</p></div>
          {canCreateContact ? <QuickLink to="/contatos?novo=contato" label="Novo contato" icon={UserRound} onNavigate={() => setOpen(false)} /> : null}
          {canCreateKnowledge ? <>
            <QuickLink to="/conhecimento?novo=produto" label="Novo produto" icon={Package} onNavigate={() => setOpen(false)} />
            <QuickLink to="/conhecimento?novo=servico" label="Novo serviço" icon={Wrench} onNavigate={() => setOpen(false)} />
            <QuickLink to="/conhecimento?novo=faq" label="Nova FAQ" icon={BookOpen} onNavigate={() => setOpen(false)} />
          </> : null}
          {canInvite ? <QuickLink to="/equipe?acao=convidar" label="Convidar membro" icon={Users} onNavigate={() => setOpen(false)} /> : null}
        </div>
      ) : null}
    </div>
  );
}

export function quickCreatePermissions(role: string): { canCreateContact: boolean; canCreateKnowledge: boolean; canInvite: boolean } {
  return {
    canCreateContact: ["OWNER", "ADMIN", "MANAGER", "AGENT"].includes(role),
    canCreateKnowledge: ["OWNER", "ADMIN", "MANAGER"].includes(role),
    canInvite: role === "OWNER" || role === "ADMIN",
  };
}

function QuickLink({ to, label, icon: Icon, onNavigate }: { to: string; label: string; icon: ComponentType<{ size?: number }>; onNavigate: () => void }) {
  return <Link className="flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm text-slate-700 transition hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600" to={to} role="menuitem" onClick={onNavigate}><span className="grid size-8 place-items-center rounded-lg bg-slate-100 text-slate-500"><Icon size={15} /></span><span className="flex-1">{label}</span><ChevronRight size={14} className="text-slate-300" /></Link>;
}

function SupportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} titleId="support-title">
      <section className="w-full max-w-md rounded-[var(--radius-dialog)] border border-app-line bg-white p-6 shadow-dialog">
        <button autoFocus className="absolute right-4 top-4 grid size-9 place-items-center rounded-brand text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" type="button" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        <span className="grid size-11 place-items-center rounded-brand bg-amber-50 text-amber-700"><CircleHelp size={21} /></span>
        <h2 className="mt-4 text-lg font-semibold text-slate-900" id="support-title">Configuração necessária</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">O canal oficial de suporte ainda não foi configurado. Nenhum atendimento será simulado ou enviado para um destino inexistente.</p>
        <Button className="mt-6 w-full" variant="outline" onClick={onClose}>Entendi</Button>
      </section>
    </Dialog>
  );
}

function DemoInfoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} titleId="demo-info-title">
      <section className="w-full rounded-none border border-amber-200 bg-white p-5 shadow-dialog sm:max-w-md sm:rounded-[var(--radius-dialog)] sm:p-6">
        <button autoFocus className="absolute right-3 top-3 grid size-9 place-items-center rounded-brand text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 sm:right-4 sm:top-4" type="button" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        <span className="grid size-11 place-items-center rounded-brand bg-amber-50 text-amber-700"><MonitorPlay size={21} /></span>
        <h2 className="mt-4 pr-10 text-lg font-semibold text-slate-900" id="demo-info-title">Você está no Modo Demonstração</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Todos os registros exibidos são identificados como DEMO e servem apenas para avaliar a interface. Nenhuma operação é enviada a clientes ou serviços externos.</p>
        <p className="mt-3 rounded-brand bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">Ações que exigem servidor mostram: <strong>“Disponível após conectar o ambiente de homologação.”</strong></p>
        <Button className="mt-6 w-full" variant="outline" onClick={onClose}>Continuar avaliando</Button>
      </section>
    </Dialog>
  );
}

function CompanyInfoDialog({ name, email, open, onClose }: { name: string; email: string; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} titleId="company-info-title">
      <section className="w-full rounded-none border border-app-line bg-white p-5 shadow-dialog sm:max-w-sm sm:rounded-[var(--radius-dialog)] sm:p-6">
        <button autoFocus className="absolute right-3 top-3 grid size-9 place-items-center rounded-brand text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 sm:right-4 sm:top-4" type="button" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        <span className="grid size-11 place-items-center rounded-brand bg-brand-50 text-brand-700"><Building2 size={21} /></span>
        <h2 className="break-anywhere mt-4 pr-10 text-lg font-semibold text-slate-900" id="company-info-title">{name}</h2>
        <p className="break-anywhere mt-2 text-sm text-slate-500">Sessão de {email}</p>
        <Button className="mt-6 w-full" variant="outline" onClick={onClose}>Fechar</Button>
      </section>
    </Dialog>
  );
}

function initials(value: string): string {
  return value.split(/\s+/u).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}
