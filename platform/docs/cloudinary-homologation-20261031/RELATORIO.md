# Homologação Cloudinary com PostgreSQL real — 31/10/2026

A reconciliação do histórico e os testes de contratos SQL foram concluídos no PostgreSQL 18.6 da branch isolada do Neon. A homologação ponta a ponta da aplicação continua pendente por bloqueio de DNS neste runtime.

## Escopo confirmado

| Item | Valor |
| --- | --- |
| Projeto Neon | atendeia-homologacao (`spring-bonus-74301423`) |
| Branch usada | atendeia-cloudinary-test-20261031 (`br-red-term-aft504d9`) |
| Banco | atendeia_homologacao |
| Branch original, preservada | `br-aged-lab-afuo49i5` |
| Commit publicado informado pelo usuário | `595431c044f39f22e07fca336a02c33cc87aaa39` |
| Base da correção | `32b5e39f999536ea728ba4c3abc2dd6a88f8082a` |
| Commit da implementação | `2b5377baea6d649026ce5577f8b5b06cbb602ecc` |
| Branch Git local | fix/cloudinary-cleanup-safe |

O SHA publicado foi fornecido pelo usuário; não houve consulta nem alteração ao serviço Render nesta etapa. A comparação local comprova que a base da correção está três commits à frente. Eles modificam apenas `knowledge-page.tsx` e `plans-page.tsx`: correções no editor de horários e nos rótulos de planos. A API é idêntica entre esses dois commits. Não foi feito rebase automático ou merge desses commits em produção.

## Reconciliação realizada antes dos testes

A tabela `MediaCleanupTask` já existia, sem a correspondente entrada no histórico Prisma. Os seis checksums anteriores coincidiam com os arquivos locais.

Criou-se uma tabela temporária a partir do SQL exato da nova migração. A comparação no próprio PostgreSQL confirmou equivalência de colunas, tipos, tamanhos, precisão temporal, nulabilidade, defaults, restrições e índices. A tabela temporária foi descartada ao término da transação.

Somente após essa verificação, inseriu-se a entrada aplicada em `_prisma_migrations`, numa transação com verificações de proteção:

- Migração: `20261031180000_media_cleanup_outbox`.
- SHA-256 do arquivo SQL: `02c72b464ff915bb60e77179531735507772fd5f73aa5456ae36b7cb0c0b1f09`.
- `finished_at` preenchido; `rolled_back_at` nulo; `applied_steps_count=0`, pois o DDL já existia.
- Resultado final: sete migrações aplicadas, sete checksums compatíveis, nenhuma migração local pendente.

A conexão direta do runtime ao endpoint da branch retornou `EAI_AGAIN` em duas tentativas. Por isso não foi possível executar `prisma migrate resolve` nem `prisma migrate status` via CLI. A reconciliação equivalente foi feita por SQL protegido, pelo conector autenticado do Neon. Nenhuma migração permanente de schema foi reaplicada; a tabela existente não foi recriada. Não se deve executar novamente o `CREATE TABLE` manualmente.

O SQL utilizado está em `01-reconcile-history.sql`. Ele verifica a equivalência antes de registrar a entrada e recusa histórico conflitante. O nome do banco, sozinho, não identifica uma branch: este arquivo só pode ser usado com conexão confirmada da branch de teste. A branch original usa o mesmo nome de banco e não foi acessada.

## Testes executados

| Verificação | Resultado |
| --- | --- |
| Contratos SQL no PostgreSQL real | 16 passaram |
| Verificações entre chamadas/concorrência no PostgreSQL real | 4 passaram |
| Testes locais da API | 74 passaram |
| Testes locais do frontend | 23 passaram |
| Guardas de DEMO/produção/homologação | 5 passaram |
| Compilação API e frontend | Passou |
| Lint API e frontend | Passou |

Os 20 testes SQL reais cobrem integridade de imagens em uso/compartilhadas, isolamento de empresa, rollback conjunto de produto/fila, validade de bloqueios de linha e consultivos, reserva condicional, reenvio sem revogar reserva, retirada da mídia com preservação da tarefa, rejeição de vínculo a mídia retirada, estado de nova tentativa, unicidade do identificador público, recuperação de reserva expirada e exclusão de tarefas concluídas da consulta de pendências.

Uma tarefa sintética foi persistida e lida em chamada posterior. Duas chamadas simultâneas tentaram reservá-la: uma afetou uma linha e a outra zero. Após expirar sua reserva, ela foi recuperada, chegando a três tentativas; a conclusão permaneceu registrada. Ao final, somente essa tarefa criada pelo teste foi removida.

Os outros fixtures foram criados e revertidos dentro de subtransações. Nenhuma chamada ao Cloudinary foi feita por esses testes SQL. O teste de recuperação simula o estado persistido após falha; não executa o código HTTP do worker.

`02-postgresql-contracts.sql` contém as 16 verificações SQL. Suas três instruções devem rodar dentro de uma mesma transação; a tabela de resultados é temporária. `03-durability-claims.sql` descreve as fases separadas de persistência e disputa. `evidence.json` registra os resultados sem credenciais ou conteúdo de clientes.

## Preservação dos dados

Antes e depois dos testes, foram comparados contagem e digest do conteúdo integral das 31 tabelas públicas de negócio da branch de teste, excluindo somente `_prisma_migrations`, cujo histórico foi reconciliado deliberadamente. Todos os 31 conjuntos de dados ficaram idênticos. A fila terminou vazia, como no início.

Não houve escrita na branch original do Neon, na `main` do Git ou no Render. As credenciais foram tratadas em arquivo privado fora do repositório e dos pacotes entregues. Elas não constam deste relatório ou das evidências.

## Pendências e próximo passo

Ainda não foram executados os quatro testes de integração da aplicação com Prisma/PostgreSQL real: três da limpeza e um de autenticação/persistência/isolamento. Eles continuam marcados como ignorados na suíte local. O conector SQL foi suficiente para validar contratos de banco, mas não substitui essas suítes nem a validação ponta a ponta.

Para executá-los, usar um runtime com acesso de rede/DNS ao endpoint direto da branch `br-red-term-aft504d9`, configurar a URL privadamente e executar:

```bash
cd platform
npm ci
npm run db:generate
npm run build
cd apps/api
node scripts/run-postgresql-acceptance.mjs
node scripts/run-media-postgresql.mjs
```

`DATABASE_URL` e `ATENDEIA_ACCEPTANCE_DATABASE_URL` devem apontar exclusivamente à branch de teste. O endpoint direto confirmado é `ep-aged-sea-afmt0kin.c-2.us-west-2.aws.neon.tech`. Não usar a conexão da branch original. Os scripts usam `migrate deploy`; com o histórico já reconciliado e estes mesmos arquivos, não há migração pendente.

Depois, ainda validar com Cloudinary de homologação os uploads, substituições, compartilhamento, falha do provedor e reinício da API. Pagamentos, WhatsApp e IA reais também não foram acionados nesta etapa. O produto não está certificado para comercialização por estes resultados isolados.

A integração GitHub recusou anteriormente a criação da branch remota (HTTP 403); não houve evidência de mudança dessas permissões nesta etapa. Os novos arquivos seguem na branch local e no pacote de revisão. Publicar/mesclar ou implantar produção continua dependendo da autorização do usuário.
