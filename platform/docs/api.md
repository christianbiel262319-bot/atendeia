# API do AtendeIA

Todas as rotas protegidas exigem `Authorization: Bearer <accessToken>` e
`x-tenant-id` igual ao tenant assinado no JWT. Corpos e parâmetros são validados
com Zod. Respostas seguem `{ data: ... }`; erros seguem
`{ error: { code, message, details? } }`.

## Rotas principais

| Módulo | Rotas |
| --- | --- |
| Auth | `/v1/auth/register`, `/login`, `/refresh`, `/logout`, `/password/*`, `/email/*`, `/sessions/*`, `/mfa/*`, `/invitations/*`, `/me` |
| Tenant | `/v1/tenant/profile`, `/v1/tenant/onboarding`, `/v1/tenant/capabilities` |
| WhatsApp | `/v1/whatsapp/connection`, `/v1/webhooks/whatsapp` |
| Conhecimento | `/v1/knowledge/*` |
| IA | `/v1/ai/configuration` |
| Conversas | `/v1/conversations/*` |
| CRM | `/v1/crm/contacts/*` |
| Equipe | `/v1/team/*` |
| Billing | `/v1/billing/*`, `/v1/webhooks/billing/:provider` |
| Mídia | `/v1/media/*` |
| Super Admin | `/v1/super-admin/*` |

O webhook do WhatsApp e os webhooks financeiros são montados antes do parser JSON
para validar a assinatura contra os bytes originais do corpo.

`GET /v1/tenant/capabilities` expõe somente flags booleanas de disponibilidade
de provedores. Chaves e segredos nunca fazem parte da resposta.

`GET /v1/auth/capabilities` expõe a disponibilidade global do envio de e-mail.
`POST /v1/auth/password/forgot` sempre responde de forma genérica e nunca
confirma se um endereço está cadastrado.
