# Arquitetura do AtendeIA

## Princípios

O backend é organizado por módulos. Cada módulo contém validações, serviços, controllers, rotas, testes e documentação. Controllers traduzem HTTP; serviços aplicam regras; Prisma concentra persistência; integrações ficam atrás de adaptadores.

## Isolamento multi-tenant

`Tenant` representa uma empresa. Recursos pertencentes a empresas possuem `tenantId`, índice por tenant e relações com exclusão restrita ou em cascata deliberada. O token de acesso carrega o tenant ativo, mas ele nunca é considerado suficiente sozinho: o middleware consulta a associação ativa entre usuário e empresa e rejeita divergência com `x-tenant-id`.

Serviços recebem `TenantContext` explicitamente. Consultas de recursos empresariais sempre combinam o identificador do recurso com `tenantId`. Métodos de acesso sem tenant não devem existir nos módulos de domínio.

## Fluxo assíncrono

Redis e BullMQ processam webhooks e o pipeline de mensagens do WhatsApp. O produtor falha rapidamente quando Redis não está disponível; workers usam repetição exponencial e encerramento gracioso. Eventos externos usam chave de idempotência e hash do payload para impedir reprocessamento. Pub/sub do Redis encaminha mudanças do worker ao servidor WebSocket, que transmite somente para sockets autenticados do mesmo tenant.

## Segredos

Tokens de refresh e códigos de uso único são armazenados apenas como hash. Credenciais de provedores ficam criptografadas com AES-256-GCM e versionamento de chave. Valores secretos nunca aparecem em logs, respostas ou auditoria.

## Módulos e fronteiras

- `auth`, `tenants` e `team`: identidade, sessão persistida, MFA, papéis e convites;
- `whatsapp`, `ai` e `knowledge`: ingestão, recuperação de contexto e resposta segura;
- `conversations` e `crm`: operação humana e relacionamento;
- `billing/providers`: contrato comum com adaptadores Stripe, Mercado Pago e Asaas;
- `media`: assinatura e registro de ativos Cloudinary por tenant;
- `super-admin`: consultas globais atrás de `PlatformMembership`, separada de qualquer papel empresarial.

`Plan` é catálogo global da plataforma; todos os recursos pertencentes a uma
empresa, inclusive assinaturas, pagamentos, eventos e mídia, carregam `tenantId`.
