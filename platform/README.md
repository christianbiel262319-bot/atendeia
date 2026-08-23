# AtendeIA Platform

Implementação modular do AtendeIA com aplicação React/Vite e API Node/Express,
preparada para operação multi-tenant com PostgreSQL. Redis, filas e integrações
externas são capacidades posteriores e ficam desligadas na homologação da Fase 1.

## Módulos implementados

- infraestrutura local com PostgreSQL e Redis;
- modelo relacional multi-tenant em Prisma;
- API Express com validação Zod, Helmet, CORS e rate limit;
- autenticação com access token, refresh token rotativo e MFA TOTP;
- contexto de tenant validado em toda rota protegida;
- auditoria de autenticação e troca de tenant;
- onboarding calculado a partir de dados reais;
- WhatsApp Cloud API com validação de assinatura, deduplicação e worker BullMQ;
- base de conhecimento para produtos, serviços, FAQs e horários;
- IA com contrato estruturado, limite de confiança e transferência humana;
- caixa de entrada em tempo real, CRM e gestão de equipe/permissões;
- uploads diretos e assinados no Cloudinary;
- billing por adaptadores para Stripe, Mercado Pago e Asaas;
- Super Admin para empresas e catálogo de planos;
- trilha de auditoria e testes dos controles críticos.

Integrações externas só devem ser ativadas após cadastrar credenciais reais e criptografadas. Nenhuma chave deve entrar no código ou no histórico Git.

## Avaliação sem infraestrutura

O frontend possui um modo DEMO restrito a builds de desenvolvimento/prévia. Ele libera a navegação com dados claramente identificados e bloqueia operações de servidor, sem criar usuário, PIN ou backdoor. Consulte [Modo Preview seguro](docs/preview-mode.md).

## Desenvolvimento local

1. Copie `.env.example` para `.env` e gere segredos fortes.
2. Defina `POSTGRES_PASSWORD` no `.env`.
3. Execute `docker compose up -d postgres`.
4. Execute `npm install`, `npm run db:generate` e `npm run db:migrate`.
5. Em terminais separados, execute `npm run dev:api` e `npm run dev:web`.

Consulte [Homologação real — Fase 1](docs/homologation-phase-1.md) para o teste
com PostgreSQL e a separação entre DEMO, homologação e produção.

O servidor expõe `GET /health`, a API versionada em `/v1` e WebSocket em
`/realtime`. Para a pilha completa em contêineres, use `docker compose up --build`;
o serviço `migrate` aplica as migrações antes de iniciar API e worker.

## Administração inicial

Depois de cadastrar e verificar uma conta real, promova explicitamente o primeiro operador:

```bash
npm run platform-owner:promote -- operador@empresa.com
```

Nenhum plano ou cliente fictício é criado automaticamente. O Platform Owner publica
o catálogo real antes de o billing aparecer para clientes.

Consulte também [arquitetura](docs/architecture.md), [segurança](docs/security.md),
[API](docs/api.md), [Modo Preview seguro](docs/preview-mode.md) e [deploy](docs/deployment.md).
