# Homologação real — Fase 1

Esta fase ativa somente frontend, API e PostgreSQL. Redis, filas, IA, WhatsApp,
uploads, cobrança e envio de e-mail permanecem desligados por
`EXTERNAL_INTEGRATIONS_ENABLED=false`.

## Separação dos ambientes

- **Preview DEMO:** build visual autorizada, fixtures locais e nenhuma chamada à API real.
- **Homologação:** `ATENDEIA_DEPLOYMENT_STAGE=homologation`, API real e PostgreSQL exclusivo de teste.
- **Produção:** `ATENDEIA_DEPLOYMENT_STAGE=production`, cookies seguros e nenhum fallback DEMO.

Não reutilize banco, segredos JWT ou chaves de criptografia entre homologação e
produção. O backend não implementa sessão DEMO.

## Inicialização

1. Provisionar um PostgreSQL exclusivo de homologação com conexão TLS e backups
   adequados ao provedor escolhido. Nenhum provedor pago é necessário para o
   código desta fase; uma instância local ou um plano dev/gratuito é suficiente.
2. Configurar as variáveis listadas abaixo no cofre do ambiente.
3. Executar `npm run db:deploy --workspace @atendeia/api`.
4. Iniciar somente API e frontend. Não iniciar o worker nem o perfil Docker
   `integrations` nesta fase.
5. Confirmar `GET /health` e `GET /ready`. A prontidão deve retornar 503 quando
   o PostgreSQL estiver indisponível.

O Sites hospeda o preview demonstrativo, mas não executa a API Node/PostgreSQL
por conexão TCP. A homologação real precisa de um runtime de backend e de um
PostgreSQL separados do preview.

## Teste de aceitação PostgreSQL

Use exclusivamente um banco descartável cujo nome contenha `test`, `homolog` ou
`hml`:

```bash
ATENDEIA_ACCEPTANCE_DATABASE_URL=<postgresql-de-teste> npm run test:postgresql
```

O comando aplica somente migrations versionadas, cria registros com
identificadores únicos, executa cadastro/login/refresh/logout/restart e testes
cross-tenant, e remove somente os registros exatos criados pelo próprio teste.
Ele recusa bancos sem um nome claramente destinado a teste.

## Operações administrativas server-side

Após verificar manualmente uma conta de teste em homologação:

```bash
npm run homologation:verify-email -- usuario@example.test
```

O comando falha fora de `homologation`, não retorna token e registra AuditLog.

Para promover um usuário existente, ativo e verificado a Platform Owner:

```bash
npm run platform-owner:promote -- usuario@example.test
```

A autorização é persistida em `PlatformMembership`, separada das funções da
empresa, e a promoção é registrada em `PlatformAuditLog`. Não existe promoção
por regra de e-mail no frontend.

## Variáveis necessárias (nomes somente)

- `NODE_ENV`
- `ATENDEIA_DEPLOYMENT_STAGE`
- `EXTERNAL_INTEGRATIONS_ENABLED`
- `PORT`
- `APP_ORIGIN`
- `DATABASE_URL`
- `REDIS_URL` (mantida para compatibilidade, sem conexão nesta fase)
- `JWT_ACCESS_SECRET`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `SECRETS_ENCRYPTION_KEY`
- `COOKIE_SECURE`
- `TRUST_PROXY`
- `LOG_LEVEL`

Variáveis administrativas/teste, usadas apenas no servidor:

- `ATENDEIA_ACCEPTANCE_DATABASE_URL`
- `HOMOLOGATION_TEST_EMAIL`
- `PLATFORM_OWNER_EMAIL`

As variáveis de provedores externos devem permanecer ausentes ou vazias nesta fase.
