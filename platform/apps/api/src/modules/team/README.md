# Equipe

Gerencia membros e convites de uma empresa. Todas as consultas administrativas são
filtradas pelo `tenantId` do contexto autenticado.

## Regras importantes

- somente `OWNER` e `ADMIN` podem convidar ou alterar membros;
- convites usam tokens aleatórios e somente o hash SHA-256 é persistido;
- o convite expira em sete dias e só pode ser aceito pelo e-mail destinatário;
- um usuário não pode desativar a própria associação;
- a empresa deve manter pelo menos um `OWNER` ativo;
- alterações relevantes geram registros de auditoria.
