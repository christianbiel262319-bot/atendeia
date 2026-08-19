# Módulo CRM

O CRM permite criação manual e também consolida contatos recebidos pela Meta.
O telefone manual usa E.164 e o identificador sem `+` é reutilizado quando a
primeira mensagem real chegar, evitando cadastro duplicado.

## Capacidades

- lista paginada por cursor, busca, filtro por origem, tag e arquivamento;
- criação e edição de nome, telefone permitido, e-mail e tags;
- ficha com as últimas conversas e notas internas com autoria;
- arquivamento preservando histórico e bloqueando contatos com atendimento
  ativo;
- restauração automática quando um contato arquivado volta a escrever;
- auditoria de criação, edição, notas, arquivamento e restauração.

Todas as consultas e mutações combinam o identificador do recurso com o
`tenantId` da sessão. Notas possuem chaves estrangeiras compostas para contato e
autor, impedindo relações entre empresas também no PostgreSQL.

Papéis `OWNER`, `ADMIN`, `MANAGER` e `AGENT` operam o CRM. `VIEWER` possui
somente leitura. Um agente exclui apenas suas próprias notas; administradores
podem excluir qualquer nota do tenant.
