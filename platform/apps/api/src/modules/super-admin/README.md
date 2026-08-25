# Super Admin

Área global da plataforma protegida exclusivamente por uma
`PlatformMembership` ativa com papel `OWNER`. O campo legado
`User.isSuperAdmin` não concede acesso.

O middleware exige uma sessão tenant válida e consulta a membership da plataforma
no banco antes de liberar cada requisição. Permite acompanhar indicadores globais,
administrar empresas e manter o catálogo real de planos. Mudanças de status e de
planos geram auditoria.

`PLATFORM_OWNER_EMAIL` é apenas uma entrada opcional do comando server-side
`npm run platform-owner:promote`. Ela não é lida no cadastro, login, refresh ou
middleware e nunca promove um usuário automaticamente. O comando exige usuário
existente, ativo e com e-mail verificado, persiste `PlatformMembership` e registra
`PlatformAuditLog`.
