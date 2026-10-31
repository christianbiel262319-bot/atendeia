# Correção de limpeza do Cloudinary — 31/10/2026

> Atualização: os quatro testes Prisma/PostgreSQL pendentes e um teste adicional de isolamento passaram. Consulte [o relatório final](cloudinary-homologation-20261031/PRISMA_E_CLOUDINARY.md). A validação com Cloudinary real está preparada e aguarda configuração segura acessível. O texto abaixo registra a primeira rodada de preparação.

## Base e verificação da implantação

- Repositório: https://github.com/christianbiel262319-bot/atendeia
- Base local obtida por clone: `32b5e39f999536ea728ba4c3abc2dd6a88f8082a` (`main`).
- Branch de trabalho local: `fix/cloudinary-cleanup-safe`.
- Publicação da branch: bloqueada. O push Git não encontrou credenciais; a integração autenticada retornou HTTP 403 (`Resource not accessible by integration`) ao tentar criar a branch. Não foi criada branch remota.
- O ZIP anexado contém um patch, não o projeto completo. Seus marcadores correspondem exatamente à base acima e a aplicação local terminou sem conflitos.
- Não foi possível comprovar equivalência com o Render: não há acesso ao serviço implantado nem SHA de implantação fornecido; os endpoints de saúde atuais não expõem a revisão Git. O status combinado do commit no GitHub não retornou verificações.
- Nenhuma publicação no Render, migração remota, chamada ao Cloudinary real ou alteração de `main` foi executada.

## Comportamento implementado

Ao substituir/remover a imagem de um produto ou excluir o produto, registra-se a imagem anterior em `MediaCleanupTask`, na mesma transação PostgreSQL. Edições do mesmo produto usam bloqueio de linha para não perder a imagem anterior em alterações concorrentes.

O processo da API consulta a fila a cada 15 segundos, em lotes de até dez tarefas. Uma reserva condicional de dois minutos impede duas instâncias de assumirem normalmente a mesma tarefa. Reenfileirar não cancela uma reserva existente. Falhas usam intervalo exponencial de cinco segundos até uma hora.

Antes de chamar o provedor, o worker valida a pasta da empresa e a identidade do arquivo, verifica as referências de produtos e remove o registro de mídia numa transação. A chave estrangeira composta existente, com `ON DELETE RESTRICT`, impede anexar a mídia removida a um produto e protege disputas com novas referências. Imagens em uso são preservadas e reavaliadas após uma hora.

O identificador público permanece na fila após a remoção do registro de mídia, permitindo nova tentativa depois de falha/reinício. São aceitos apenas resultados `ok` ou `not found` do Cloudinary. A confirmação permanece registrada em `completedAt`, sem ser selecionada novamente pelo worker.

O cadastro de mídia e a retirada pelo worker usam o mesmo bloqueio consultivo transacional por empresa/identificador público. Depois de `retiredAt`, um cadastro repetido é recusado com `MEDIA_RETIRED`, inclusive após a conclusão da exclusão. Isso evita recriar uma referência válida para uma imagem que está sendo apagada. Também não é permitido mudar o tipo de um arquivo já registrado. Um novo upload deve receber um novo identificador.

A exclusão manual passa a solicitar a mesma fila: sua resposta confirma o enfileiramento, não a exclusão imediata no provedor. Ela continua recusando imagens em uso e registra `media.deletion_requested` na auditoria. Vídeos/arquivos raw continuam suportados por essa operação. O worker não roda quando integrações externas estão desabilitadas ou faltam credenciais.

A função de assinatura foi extraída sem alterar seu algoritmo e permanece reexportada pelo serviço anterior para compatibilidade.

## Validação executada

| Verificação | Resultado |
| --- | --- |
| Instalação pelo lockfile e geração Prisma | Passou |
| Build TypeScript da API e build de produção do frontend | Passaram |
| Lint da API e frontend | Passou |
| Testes da API | 74 passaram; 4 testes de PostgreSQL real não executados |
| Testes do frontend | 23 passaram |
| Guardas de build DEMO/produção/homologação | 5 passaram |
| `git diff --check` | Passou |

Total: **102 testes executados com sucesso**. Os testes existentes abrangem contratos de autenticação, segurança de webhooks/pagamentos, relações entre empresas, IA, schemas e modo demonstração. Isso não equivale a validação ponta a ponta com provedores reais.

Foram acrescentados 15 testes unitários de comportamento do worker/cadastro, um teste de migrações, rollback, integridade e persistência em disco usando PGlite, e três testes opcionais com Prisma/PostgreSQL real. O PGlite é uma dependência de testes preexistente; não foi introduzido na aplicação nem substitui PostgreSQL de homologação.

A execução de `run-media-postgresql.mjs` parou explicitamente por ausência de `ATENDEIA_ACCEPTANCE_DATABASE_URL`. Não há servidor PostgreSQL disponível no ambiente; a tentativa de instalação local falhou por restrições de permissões do sistema. Nenhuma credencial ou dado de produção foi usado. As novas verificações PostgreSQL ainda precisam ser executadas, inclusive para validar os bloqueios e disputas entre workers.

## Escopo preservado e limites

Não foram modificados módulos de autenticação, planos, cobrança, IA, WhatsApp, frontend ou DEMO. As mudanças funcionais ficam nos serviços de mídia/produtos, inicialização/encerramento do worker e uma migração aditiva.

A proteção de referências cobre os vínculos `Product.imageAssetId` registrados no banco. URLs copiadas para sites externos, textos livres ou integrações fora desse relacionamento não são rastreadas.

Não há varredura retroativa, limpeza de uploads abandonados antes de vincular a produtos nem limpeza completa de empresas removidas. Tarefas concluídas são mantidas como registros de proteção contra reutilização de identificadores; não devem ser apagadas indiscriminadamente. Não há ainda política de arquivamento desses registros.

Antes de comercializar, continuam necessários os testes reais de PostgreSQL, Cloudinary, WhatsApp, IA e cobrança, além da conferência da versão implantada. Esta correção não certifica o produto inteiro como pronto para venda.

## Como validar em ambiente isolado

Use um PostgreSQL exclusivo, sem outros workers rodando; o nome do banco deve conter `test`, `homolog` ou `hml`. Configure `ATENDEIA_ACCEPTANCE_DATABASE_URL` por meio seguro no ambiente, nunca em arquivos versionados. Os scripts abaixo aplicam migrações somente ao banco informado.

```bash
cd platform
npm ci
npm run db:generate
npm run build
npm test
npm run lint
cd apps/api
node scripts/run-postgresql-acceptance.mjs
node scripts/run-media-postgresql.mjs
```

`db:generate` exige `DATABASE_URL` configurada. As chamadas ao Cloudinary na nova suíte PostgreSQL são simuladas; em homologação, ainda validar uploads reais, substituição, remoção, compartilhamento, indisponibilidade do provedor e reinício da API.

Antes de implantar, comparar o SHA do último deploy no painel Render com a base desta branch e revisar eventuais diferenças. Aplicar a migração aditiva antes de iniciar o código novo. A publicação em produção depende de autorização do responsável; não foi realizada.

Para interromper a limpeza numa eventual reversão, parar as instâncias novas e voltar ao código anterior, mantendo a tabela e os registros da fila. A remoção já realizada no Cloudinary não é reversível por rollback de código. Não reverter apagando a tabela: isso perderia solicitações e registros de proteção.
