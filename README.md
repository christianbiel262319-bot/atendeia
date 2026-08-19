# AtendeIA

SaaS B2B multi-tenant para automação de atendimento via WhatsApp com IA e
transferência segura para atendimento humano.

## Estado atual

O frontend possui uma única fonte canônica em `platform/apps/web`. A pasta
`app/` é apenas o adaptador de hospedagem e importa essa mesma aplicação, sem
manter uma segunda interface ou dados demonstrativos.

A API Express, o worker e os serviços de PostgreSQL/Redis permanecem em
`platform/` e precisam ser publicados em uma infraestrutura compatível. Até
isso ocorrer, a interface hospedada apresenta erros reais de indisponibilidade;
ela não simula operações ou sucesso.

Consulte a [auditoria da Fase 1](platform/docs/audit-v2-phase-1.md) para a matriz
de funcionalidades, riscos encontrados e sequência de evolução.

## Produto canônico

```text
platform/
├── apps/api   Express + TypeScript + Prisma + PostgreSQL + Redis + BullMQ + WebSocket
├── apps/web   React + TypeScript + Vite + Tailwind + React Router + TanStack Query
└── docs       arquitetura, segurança, API, deploy e auditorias
```

O adaptador em `app/` compartilha rotas, componentes e tokens diretamente com
`platform/apps/web`, eliminando a divergência entre demonstração e produto.

Princípios já adotados:

- o tenant vem do token e da associação ativa, nunca do corpo enviado pelo frontend;
- consultas de negócio incluem `tenantId` explicitamente;
- refresh tokens são opacos, armazenados como hash e rotacionados;
- segredos são criptografados com AES-256-GCM;
- webhooks são autenticados, deduplicados e processados por fila;
- integrações sem credenciais retornam `Configuração necessária` e não simulam sucesso;
- a IA usa contrato estruturado e somente conhecimento ativo do tenant.

## Desenvolvimento local

1. Copie `platform/.env.example` para `platform/.env`.
2. Gere segredos fortes para JWT, criptografia, PostgreSQL e Redis.
3. Suba PostgreSQL e Redis com `docker compose` dentro de `platform/`.
4. Instale as dependências e gere o Prisma Client.
5. Aplique as migrations.
6. Inicie API, worker e frontend em processos separados.

As credenciais de OpenAI, Meta, Cloudinary e provedores de pagamento são
opcionais para iniciar a base. Cada capacidade permanece indisponível e
claramente sinalizada até receber configuração real.

## Verificação

Dentro de `platform/`:

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run db:generate`

Não há seed de clientes, planos ou métricas fictícias.

## Documentação

- [Arquitetura](platform/docs/architecture.md)
- [Segurança](platform/docs/security.md)
- [API](platform/docs/api.md)
- [Deploy](platform/docs/deployment.md)
- [Auditoria V2 — Fase 1](platform/docs/audit-v2-phase-1.md)
- [Design System V2](platform/docs/design-system-v2.md)
