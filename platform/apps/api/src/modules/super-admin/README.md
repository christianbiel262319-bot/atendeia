# Super Admin

Área global da plataforma protegida por `User.isSuperAdmin`. O middleware exige uma
sessão tenant válida e consulta novamente o usuário no banco antes de liberar cada
requisição. Permite acompanhar indicadores globais, administrar empresas e manter o
catálogo real de planos. Mudanças de status e de planos geram auditoria.
