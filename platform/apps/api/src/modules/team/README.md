# Equipe

Gerencia membros e convites de uma empresa. Todas as consultas administrativas são
filtradas pelo `tenantId` do contexto autenticado.

## Regras importantes

- `OWNER` pode convidar `ADMIN` e `AGENT`; `ADMIN` pode gerenciar somente `AGENT`;
- `ADMIN` não pode alterar `OWNER`, outro `ADMIN`, a própria função ou elevar privilégios;
- convites usam tokens aleatórios e somente o hash SHA-256 é persistido;
- o convite expira em sete dias e só pode ser aceito pelo e-mail destinatário;
- um usuário não pode desativar a própria associação;
- a empresa deve manter pelo menos um `OWNER` ativo;
- alterações relevantes geram registros de auditoria.

Os papéis operacionais novos da V2 são `OWNER`, `ADMIN` e `AGENT`. Valores
legados `MANAGER` e `VIEWER` continuam reconhecidos no banco para permitir uma
migração posterior sem perda de dados, mas não podem ser atribuídos pela API.
