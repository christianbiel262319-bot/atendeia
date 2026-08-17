# Controles de segurança

- senhas com bcrypt e custo configurado;
- access tokens JWT curtos e refresh tokens opacos, rotativos e vinculados a uma família;
- detecção de reutilização revoga toda a família de refresh tokens;
- MFA TOTP com segredo criptografado e proteção contra reutilização do mesmo passo;
- cookies `HttpOnly`, `SameSite=Strict`, `Secure` em produção e proteção CSRF por double submit;
- Helmet, CORS por allowlist, limites de corpo e rate limits separados para autenticação;
- Zod na fronteira HTTP;
- Prisma com consultas parametrizadas;
- contexto multi-tenant validado no servidor;
- logs estruturados sem dados sensíveis e trilha de auditoria;
- assinatura HMAC do webhook Meta sobre o corpo bruto;
- assinaturas/tokens de webhooks financeiros, janela antirreplay e deduplicação;
- uploads Cloudinary assinados e restritos à pasta do tenant;
- tokens de acesso mantidos apenas em memória no navegador e renovação serializada;
- WebSocket autenticado, validado novamente contra associação e status do tenant;
- erros conhecidos do banco convertidos sem expor consultas ou detalhes internos.

Antes de produção: executar análise de dependências, testes de penetração, rotação de segredos, backup/restauração do PostgreSQL e teste de indisponibilidade do Redis.
