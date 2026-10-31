# Homologação final com Prisma/PostgreSQL e preparação do Cloudinary

Os quatro testes que estavam pendentes em `042d124` foram executados com Prisma e PostgreSQL reais e passaram. Um quinto teste confirmou o isolamento de imagens entre empresas. A validação com Cloudinary real está preparada e permanece pendente de configuração segura acessível das chaves desse serviço.

## Ambiente e acesso ao banco

- Base desta etapa: `042d1241cfc2e0e5f6500cf53bac095c632976a5`.
- Projeto: `atendeia-homologacao` (`spring-bonus-74301423`).
- Branch isolada: `atendeia-cloudinary-test-20261031` (`br-red-term-aft504d9`).
- Banco: `atendeia_homologacao`, PostgreSQL 18.6.
- Node.js 24.22.1, Prisma/PrismaNeon 7.9.1, driver Neon 1.2.0.

A conexão TCP direta não resolve o DNS neste runtime. O endpoint HTTPS funciona pelo proxy já configurado. O transporte WebSocket oficial do Neon foi usado com o adaptador PrismaNeon e esse proxy, mantendo transações interativas e consultas reais ao PostgreSQL.

O transporte alternativo é carregado somente nos processos de teste. O servidor local usado pelo teste de autenticação também recebe o transporte por um preload, inclusive após reinício. Nenhuma consulta de banco é simulada. O módulo de conexão de produção, que continua usando PrismaPg, não foi alterado.

O novo runner recusa qualquer host/banco diferente do endpoint fixado da branch isolada, exige Node 24 e confere checksums das sete migrações antes dos testes. Também exige fila de limpeza inicialmente vazia. O runner só lê o histórico: não chama `migrate deploy`, `migrate resolve`, `db push`, nem executa SQL de migração.

## Resultados reais

| Teste | Resultado |
| --- | --- |
| Imagem compartilhada preservada; limpeza após último vínculo; cadastro antigo recusado após retirada | Passou |
| Rollback conjunto do produto e da tarefa de limpeza | Passou |
| Falha do provedor, reconexão do Prisma e disputa entre dois consumidores | Passou |
| Cadastro, empresa e contato persistidos após logout/reinício; sessões e isolamento entre dois tenants | Passou |
| Tentativas de outra empresa vincular ou excluir uma imagem; ausência de chamada ao provedor | Passou, teste adicional |

O cenário de autenticação também verificou senha incorreta, revogação de acesso após logout, renovação e reutilização indevida de refresh token, token expirado, injeção de tenant em query/body/header, proteção de contatos/conversas/produtos/configuração de IA e acesso ao Super Admin. O reinício ocorreu no processo real da API local, com o mesmo banco remoto.

As chamadas ao Cloudinary nos quatro testes de mídia desta rodada foram simuladas. Os registros, transações, chaves estrangeiras, bloqueios, reservas, retomada de tarefas e reconexão do Prisma foram reais. Esse resultado não comprova o comportamento do Cloudinary em produção.

A primeira execução completa identificou um limite de 30 segundos insuficiente para o cenário remoto de autenticação. O prazo desse teste passou a 120 segundos somente quando o transporte de homologação está ativado. Outra execução encontrou uma expectativa antiga do teste: o retorno de empresa agora inclui `slug` e `timezone`. A asserção foi atualizada para verificar `id`, nome e fuso horário persistido, sem mudar a resposta da API. A execução final desse cenário passou em cerca de 44 segundos.

## Preservação e regressão

Antes e depois de cada rodada final foram comparados contagem e digest do conteúdo das 32 tabelas públicas, incluindo `_prisma_migrations`. Todos ficaram idênticos. As duas rodadas finais também partiram do mesmo conjunto de dados. Os fixtures criados foram removidos apenas pelos IDs/tenants exclusivos da rodada.

A tabela `MediaCleanupTask` não foi recriada. Permanecem sete migrações registradas, com checksums compatíveis. Nenhuma migração ou alteração permanente de schema foi executada nesta etapa.

Também passaram 79 testes locais da API, 23 do frontend e cinco verificações de build/DEMO: **107 verificações locais**, além dos cinco testes reais acima. Compilação da API/frontend, lint e verificações dos scripts TypeScript passaram. Na suíte local comum, os cinco testes PostgreSQL são ignorados deliberadamente e executados pelo runner dedicado; o único teste de provedor real ainda pendente é o Cloudinary.

A `main` permanece em `32b5e39f999536ea728ba4c3abc2dd6a88f8082a`. O commit Render informado anteriormente é `595431c044f39f22e07fca336a02c33cc87aaa39`. Não houve escrita, implantação, reinício ou alteração de configuração no Render, nem alteração da branch principal do Neon. Nenhum código sob `platform/apps/api/src` foi alterado nesta etapa.

## Validação preparada para Cloudinary real

O teste está em `tests/cloudinary-live.postgresql.integration.test.ts`, com configuração própria e ativação explícita. Ele cria duas empresas de teste, envia duas imagens PNG de um pixel e usa os serviços reais de mídia/produtos e o worker da aplicação.

As proteções incluem:

- Identificador público novo por empresa e UUID da rodada, com upload assinado e `overwrite=false`.
- Consulta de existência antes do upload, sem listar ou varrer arquivos da conta.
- Manifesto dos arquivos criados, com `asset_id` retornado pelo upload.
- Conferência de `public_id`, `asset_id`, tipo e tag exclusiva da rodada antes de excluir.
- Bloqueio de pedidos de exclusão fora do manifesto; nenhuma exclusão por prefixo ou em massa.
- Verificação de compartilhamento e isolamento entre empresas; uma resposta 503 induzida no teste antes do primeiro pedido de exclusão real, para verificar nova tentativa e recuperação após reconectar o Prisma.
- Conferência da exclusão pelo Admin API, pois URLs de entrega podem continuar em cache.
- Limpeza final limitada aos arquivos e registros dessa rodada, com manifesto seguro para eventual resíduo.

Cinco testes unitários das proteções do manifesto passaram, incluindo rejeição de arquivo existente fora do escopo, troca do `asset_id`, tag diferente e injeção no caminho da empresa.

O preflight do teste real foi executado e parou com código 2 antes de qualquer upload ou escrita de fixtures. As variáveis do Cloudinary não estão disponíveis no ambiente atual nem na configuração segura acessível do Site associado; a busca por integração específica também não retornou uma conexão utilizável. Nenhum arquivo foi enviado ou excluído no Cloudinary nesta etapa.

## Como repetir os testes

Use Node 24 e a branch de teste sem outro processo da API/worker acessando sua fila. Carregue `ATENDEIA_ACCEPTANCE_DATABASE_URL` pelo gerenciador de segredos do runner. A URL deve ser a conexão direta da branch isolada, com host `ep-aged-sea-afmt0kin.c-2.us-west-2.aws.neon.tech` e banco `atendeia_homologacao`. As credenciais não devem ser copiadas para o Git, documentos ou mensagens.

```bash
cd platform
npm ci
cd apps/api
npm run test:neon-proxy
```

É possível repetir apenas um grupo com `-- --auth-only` ou `-- --media-only`. O runner produz os resultados JSON e os snapshots em `test-evidence/neon`, ou no diretório informado por `ATENDEIA_TEST_EVIDENCE_DIR`. Esses arquivos locais não devem ser versionados automaticamente.

Para o Cloudinary, o ambiente seguro do mesmo runner precisa fornecer `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET`. Também são necessárias a confirmação da conta em `ATENDEIA_CLOUDINARY_EXPECTED_CLOUD` e a ativação `ATENDEIA_RUN_CLOUDINARY_LIVE=true`. Não há credenciais no pacote.

```bash
npm run test:neon-proxy -- --cloudinary
```

O comando confere o banco e o histórico sem executar migrations. Se faltar configuração ou se o destino divergir, ele para antes da validação real. As novas dependências estão limitadas a `devDependencies`. A versão de produção continua usando o driver existente.

## Pendência restante nesta correção

Executar o teste preparado contra Cloudinary real, num runner com as variáveis seguras disponíveis. A conexão TCP do ambiente continua indisponível; o WebSocket removeu esse impedimento para os testes da aplicação, mas não constitui validação do transporte TCP usado no host de produção. Não houve publicação nem teste ponta a ponta do ambiente Render.

As restrições de escrita GitHub observadas anteriormente não foram alteradas. Os resultados e o código ficam no commit local de revisão e no pacote entregue. Publicar/mesclar em produção continua dependendo de autorização.

Referências técnicas: [Neon com Prisma](https://neon.com/docs/guides/prisma), [configuração do driver Neon](https://neon.com/docs/serverless/serverless-driver-configuration), [Cloudinary Upload API](https://cloudinary.com/documentation/image_upload_api_reference) e [Cloudinary Admin API](https://cloudinary.com/documentation/admin_api). As referências orientaram o transporte e as proteções do roteiro; os resultados acima vêm das execuções registradas em `evidence-prisma-final.json`.
