# Módulo Tenants

O middleware valida JWT, compara o tenant ativo com `x-tenant-id` e consulta a associação no banco. A associação precisa continuar ativa; portanto, remover um usuário da empresa invalida imediatamente o acesso, mesmo que o JWT ainda não tenha expirado.

Serviços de domínio recebem `TenantContext`. Consultas de entidades empresariais devem usar `where: { id, tenantId }` ou uma chave composta equivalente. Um identificador isolado nunca autoriza acesso.
