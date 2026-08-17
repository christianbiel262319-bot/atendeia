# Billing

Orquestra assinaturas nos provedores Stripe, Mercado Pago e Asaas por meio de
adaptadores independentes. Os planos são cadastrados pelo super administrador; o
cliente escolhe apenas planos ativos persistidos no banco.

## Segurança e consistência

- chaves dos provedores são carregadas somente do ambiente de produção;
- chamadas de criação usam chaves de idempotência baseadas na assinatura local;
- webhooks exigem assinatura/token, janela contra replay e deduplicação no banco;
- assinaturas e pagamentos sempre carregam `tenantId`;
- respostas dos provedores são validadas com Zod e erros não expõem payloads sensíveis.
