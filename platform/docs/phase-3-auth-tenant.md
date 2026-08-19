# AtendeIA V2 — Fase 3: autenticação, tenant e empresa

## Entregas

- recuperação de senha com resposta anti-enumeração, token de uso único,
  expiração e revogação total de sessões;
- verificação de e-mail com token hasheado e capacidade explícita do provedor;
- cadastro por convite diretamente no tenant correto;
- listagem, revogação individual e revogação das demais sessões;
- alteração de senha mantendo apenas a sessão atual;
- ativação e desativação de MFA com senha, TOTP e proteção de replay;
- edição auditada de nome pessoal, nome da empresa e fuso horário;
- interface de configurações separada em Empresa, Perfil e Segurança;
- lazy loading por rota no frontend;
- chaves estrangeiras compostas para impedir relações cruzadas de tenant entre
  contato/conversa, conversa/mensagem, conversa/responsável e
  assinatura/pagamento.

## Provedor de e-mail

O código utiliza a API HTTP do Resend sem enviar a chave ao frontend. Quando
`RESEND_API_KEY` ou `EMAIL_FROM` estão ausentes, as telas mostram
**Configuração necessária** e bloqueiam o envio. Tokens nunca são retornados na
resposta nem escritos em logs.

## Validação

A suíte executa as migrations em PostgreSQL embutido (PGlite) e comprova que a
Empresa B não consegue relacionar seus registros aos contatos, conversas ou
membros da Empresa A. O ambiente ainda precisa repetir essa suíte contra o
PostgreSQL gerenciado escolhido para produção antes do go-live.

## Limites remanescentes

- não há credenciais reais de e-mail neste repositório;
- não foi realizado teste de entrega com domínio verificado;
- recuperação/verificação ainda não usam uma fila dedicada de e-mail;
- políticas de sessão e retenção devem ser calibradas com telemetria real.
