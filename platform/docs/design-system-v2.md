# AtendeIA — Design System V2

## Princípios

O Design System V2 prioriza densidade adequada a um SaaS B2B, hierarquia clara,
contraste, navegação rápida e feedback honesto. A identidade preserva o verde do
AtendeIA sem depender dos valores genéricos da paleta padrão do framework.

## Tokens

Os tokens ficam centralizados em `apps/web/src/styles.css` e são consumidos pela
aplicação Vite e pelo adaptador de hospedagem.

| Grupo | Tokens principais | Uso |
|---|---|---|
| Cor | `brand-50` a `brand-950` | Identidade, foco, ações e estados positivos |
| Superfície | `app-canvas`, `app-surface`, `app-line` | Fundo, cards e divisores |
| Texto | `app-ink`, `app-muted` | Conteúdo principal e secundário |
| Espaçamento | `--space-1` a `--space-10` | Ritmo de componentes e páginas |
| Raio | `--radius-control`, `--radius-card`, `--radius-dialog` | Controles, cards e modais |
| Sombra | `shadow-brand`, `shadow-sidebar`, `shadow-popover`, `shadow-dialog` | Elevação com baixa interferência visual |
| Tipografia | `--font-sans`, `--font-size-*`, `--line-body` | Escala e legibilidade |
| Movimento | `--motion-*`, `--ease-product` | Feedback rápido e consistente |

O modo `prefers-reduced-motion` reduz animações e transições globalmente.

## Navegação

A sidebar é organizada por contexto: Visão geral, Atendimento, Inteligência,
Gestão e Sistema. Ela oferece:

- collapse persistido localmente no desktop;
- drawer com backdrop no mobile;
- tooltips quando recolhida;
- badge derivado do total real de conversas aguardando humano;
- acesso ao Super Admin somente quando a sessão informa essa permissão;
- menu de criação rápida limitado a rotas existentes e funções autorizadas.

## Componentes compartilhados

- `Button`, `Input`, `Select` e `Textarea` compartilham tamanho de toque, foco,
  estados desabilitados e tokens;
- `Card` aplica superfície, borda e raio padronizados;
- `Dialog` implementa Escape, bloqueio de scroll e contenção de foco;
- `LoadingState`, `ErrorNotice`, `SuccessNotice` e `EmptyState` cobrem os estados
  assíncronos básicos sem fabricar dados.

## Regra de honestidade

Uma ação externa indisponível deve usar o estado **Configuração necessária**.
Nenhum componente do sistema pode substituir integração ausente por timeout,
valor aleatório, mensagem falsa de sucesso ou persistência apenas no navegador.
