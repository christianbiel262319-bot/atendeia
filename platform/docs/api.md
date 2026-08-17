# API do AtendeIA

Todas as rotas protegidas exigem `Authorization: Bearer <accessToken>` e
`x-tenant-id` igual ao tenant assinado no JWT. Corpos e parâmetros são validados
com Zod. Respostas seguem `{ data: ... }`; erros seguem
`{ error: { code, message, details? } }`.

## Rotas principais

| Módulo | Rotas |
| --- | --- |
| Auth | `/v1/auth/register`, `/login`, `/refresh`, `/logout`, `/mfa/*`, `/me` |
| Onboarding | `/v1/tenant/onboarding` |
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
