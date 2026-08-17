"use client";

import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Headphones,
  Inbox,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Settings,
  Sparkles,
  Users,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";
import { useState } from "react";

const navigation = [
  { label: "Visão geral", icon: BarChart3, active: true },
  { label: "Atendimentos", icon: Inbox },
  { label: "Contatos", icon: UserRound },
  { label: "Conhecimento", icon: BookOpen },
  { label: "Automação", icon: WandSparkles },
  { label: "Equipe", icon: Users },
  { label: "Planos e cobrança", icon: CreditCard },
];

const setupSteps = [
  {
    title: "Conecte seu WhatsApp",
    description: "Vincule seu número oficial pela API da Meta.",
    icon: MessageCircle,
    action: "Conectar",
  },
  {
    title: "Adicione conhecimento",
    description: "Cadastre produtos, serviços, horários e dúvidas.",
    icon: BookOpen,
    action: "Cadastrar",
  },
  {
    title: "Configure a IA",
    description: "Defina o tom e as regras do seu atendimento.",
    icon: Bot,
    action: "Configurar",
  },
  {
    title: "Convide sua equipe",
    description: "Prepare as transferências para atendimento humano.",
    icon: Users,
    action: "Convidar",
  },
];

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden="true">
        <Sparkles size={20} strokeWidth={2.4} />
      </div>
      <div>
        <strong>AtendeIA</strong>
        <span>Central inteligente</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-head">
          <Brand />
          <button
            className="icon-button sidebar-close"
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="nav" aria-label="Navegação principal">
          <span className="nav-eyebrow">Workspace</span>
          {navigation.map(({ label, icon: Icon, active }) => (
            <button
              className={`nav-item ${active ? "nav-item-active" : ""}`}
              type="button"
              key={label}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
              {label === "Atendimentos" && <span className="nav-count">0</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <button className="support-link" type="button">
          <CircleHelp size={18} />
          Central de ajuda
        </button>

        <div className="tenant-card">
          <div className="tenant-avatar">SE</div>
          <div className="tenant-copy">
            <strong>Sua empresa</strong>
            <span>Plano não configurado</span>
          </div>
          <button className="icon-button" type="button" aria-label="Configurações da empresa">
            <Settings size={17} />
          </button>
        </div>
      </aside>

      {menuOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          type="button"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <section className="content-shell">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            type="button"
            aria-label="Abrir menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={21} />
          </button>

          <div className="mobile-brand">
            <Brand />
          </div>

          <label className="search-box">
            <Search size={18} />
            <input aria-label="Pesquisar" placeholder="Pesquisar no AtendeIA" />
            <kbd>⌘ K</kbd>
          </label>

          <div className="topbar-actions">
            <button className="icon-button notification-button" type="button" aria-label="Notificações">
              <Bell size={19} />
              <span className="notification-dot" />
            </button>
            <button className="primary-button" type="button">
              <Plus size={18} />
              Configurar atendimento
            </button>
          </div>
        </header>

        <div className="dashboard">
          <section className="welcome-row">
            <div>
              <span className="section-kicker">VISÃO GERAL</span>
              <h1>Seu atendimento começa aqui</h1>
              <p>Configure os pontos essenciais para colocar sua IA no WhatsApp.</p>
            </div>
            <div className="connection-badge">
              <span />
              WhatsApp não conectado
            </div>
          </section>

          <section className="setup-card" aria-labelledby="setup-title">
            <div className="setup-card-head">
              <div>
                <span className="eyebrow-chip"><Sparkles size={14} /> Primeiros passos</span>
                <h2 id="setup-title">Prepare seu atendimento</h2>
                <p>Complete as quatro etapas para ativar o AtendeIA.</p>
              </div>
              <div className="progress-copy">
                <strong>0 de 4</strong>
                <span>0% concluído</span>
              </div>
            </div>
            <div className="progress-track" aria-label="Progresso: zero por cento">
              <span style={{ width: "0%" }} />
            </div>

            <div className="setup-grid">
              {setupSteps.map(({ title, description, icon: Icon, action }, index) => (
                <article className="setup-step" key={title}>
                  <div className="step-topline">
                    <div className="step-icon"><Icon size={20} /></div>
                    <span className="step-number">0{index + 1}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <button type="button">
                    {action} <ChevronRight size={16} />
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="metrics-grid" aria-label="Resumo do atendimento">
            <MetricCard title="Atendimentos" value="0" caption="Nenhuma conversa iniciada" icon={Headphones} tone="mint" />
            <MetricCard title="Mensagens" value="0" caption="Nenhuma mensagem recebida" icon={MessageCircle} tone="blue" />
            <MetricCard title="Transferências" value="0" caption="Nenhuma transferência" icon={Users} tone="amber" />
            <MetricCard title="Tempo médio" value="—" caption="Sem dados suficientes" icon={BarChart3} tone="violet" />
          </section>

          <section className="bottom-grid">
            <article className="panel whatsapp-panel">
              <div className="panel-head">
                <div>
                  <span className="section-kicker">CANAL PRINCIPAL</span>
                  <h2>Estado do WhatsApp</h2>
                </div>
                <button className="text-button" type="button">Ver configurações <ChevronRight size={16} /></button>
              </div>

              <div className="empty-connection">
                <div className="whatsapp-orbit">
                  <span className="orbit-ring" />
                  <div className="whatsapp-icon"><MessageCircle size={29} /></div>
                </div>
                <div>
                  <h3>Seu número ainda não está conectado</h3>
                  <p>Conecte a API oficial do WhatsApp para receber e responder mensagens com segurança.</p>
                </div>
                <button className="secondary-button" type="button">Conectar WhatsApp</button>
              </div>
            </article>

            <article className="panel activity-panel">
              <div className="panel-head">
                <div>
                  <span className="section-kicker">TEMPO REAL</span>
                  <h2>Atividade recente</h2>
                </div>
                <span className="live-pill"><span /> Ao vivo</span>
              </div>
              <div className="empty-activity">
                <div className="activity-icon"><Inbox size={23} /></div>
                <h3>Nenhuma atividade ainda</h3>
                <p>As novas conversas e ações da equipe aparecerão aqui.</p>
              </div>
            </article>
          </section>
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  title,
  value,
  caption,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  caption: string;
  icon: typeof Headphones;
  tone: string;
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon metric-${tone}`}><Icon size={20} /></div>
      <div className="metric-content">
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{caption}</small>
      </div>
    </article>
  );
}
