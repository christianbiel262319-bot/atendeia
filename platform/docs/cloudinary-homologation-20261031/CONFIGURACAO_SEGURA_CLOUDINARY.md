# Cloudinary real: configuração segura e execução isolada

## Estado desta etapa

O runner e o teste real já estão preparados. As chaves Cloudinary não estão presentes no ambiente de execução atual. A integração Render disponível permite atualizar variáveis, mas não oferece uma operação para ler seus valores e injetá-los no runner. Não foi feita leitura por navegador, alteração ou nova publicação no Render.

Foi verificada a alternativa de executar exclusivamente o teste real no GitHub Actions, recebendo as chaves por Environment secrets. Os valores são inseridos diretamente no GitHub pelo proprietário e não passam por esta conversa. O teste continua usando somente a branch isolada do Neon.

A tentativa de criar a branch remota retornou HTTP 403 (`Resource not accessible by integration`). Portanto, o workflow está preparado no pacote e na branch local `test/cloudinary-real-20261031`, mas ainda não foi publicado ou executado no GitHub. Não há resultado de teste Cloudinary real nesta etapa.

Os testes PostgreSQL anteriores não foram repetidos. Só foram verificados sintaxe/configuração do workflow, compilação/lint e a ausência de segredos no resumo de resultados. O preflight Cloudinary confirmou que para antes de acessar banco/provedor quando falta configuração. Nenhuma imagem foi enviada ou excluída.

## 1. Criar uma credencial exclusiva de testes no Cloudinary

No Console do Cloudinary, abra **Settings > API Keys** e gere um novo par com **Generate New API Key**. Identifique a chave como `atendeia-homologacao`. Use essa nova chave nos testes e mantenha a chave atual do Render como está.

O teste precisa fazer upload de imagem, consultar o recurso individual no Admin API e excluir os arquivos descartáveis da própria rodada. Uma chave separada permite encerrar o acesso dos testes sem trocar a credencial usada pela aplicação. Ela não cria, por si só, uma divisão de arquivos dentro da conta: a proteção dos arquivos é feita pelo manifesto, UUID da rodada, asset_id e tag conferidos pelo teste.

Se já houver um product environment separado para homologação, use suas credenciais e seu cloud name. Não é necessário modificar o serviço Render para nenhuma dessas opções. Não envie valores ou capturas da tela de credenciais para a conversa.

## 2. Criar o ambiente de execução no GitHub

Acesse:

https://github.com/christianbiel262319-bot/atendeia/settings/environments

Crie um ambiente chamado exatamente:

`atendeia-cloudinary-homologacao`

Na configuração de branches permitidas, escolha **Selected branches and tags**, adicione uma regra do tipo Branch e informe:

`test/cloudinary-real-20261031`

O repositório estava público na conferência desta etapa. A documentação atual do GitHub disponibiliza environments e seus secrets para repositórios públicos nos planos atuais. O workflow recusa outra branch, outro repositório ou execução em `main`.

Embora o GitHub use o termo Environment/deployment para essa configuração, este workflow não faz deploy de aplicação, não chama o Render e não publica frontend/API. Ele usa o recurso somente para controlar o acesso aos segredos do teste.

## 3. Cadastrar quatro Environment secrets

Dentro desse ambiente, use **Environment secrets > Add secret** para cada entrada:

| Nome | Valor a cadastrar privadamente no GitHub |
| --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Cloud name do ambiente Cloudinary escolhido para o teste |
| `CLOUDINARY_API_KEY` | Nova chave de teste |
| `CLOUDINARY_API_SECRET` | Segredo dessa chave de teste |
| `ATENDEIA_ACCEPTANCE_DATABASE_URL` | Conexão direta da branch isolada do Neon |

Para a última entrada, no Neon selecione o projeto `atendeia-homologacao`, a branch `atendeia-cloudinary-test-20261031` e o banco `atendeia_homologacao`. Na opção de conexão, desative pooling. O hostname deve ser exatamente `ep-aged-sea-afmt0kin.c-2.us-west-2.aws.neon.tech`.

Não use a conexão da branch principal. O runner recusa hosts diferentes. Copie o valor diretamente do Neon para o campo Secret do GitHub, sem enviá-lo pela conversa ou gravá-lo no repositório.

O workflow preenche automaticamente a confirmação do cloud name e a ativação explícita do modo real. Não é necessário criar outros secrets ou variáveis no Render.

## 4. Publicar somente a branch de testes

Como a integração retornou 403, esta etapa precisa ser executada por uma conta GitHub autenticada sua. No terminal de um clone do repositório com árvore de trabalho limpa, use o bundle do pacote, substituindo `/caminho/do/pacote` pelo caminho da pasta extraída:

```bash
git status --short
git fetch origin
git bundle verify /caminho/do/pacote/atendeia-cloudinary.bundle
git fetch /caminho/do/pacote/atendeia-cloudinary.bundle refs/heads/test/cloudinary-real-20261031:refs/remotes/cloudinary-review/live
git switch -c test/cloudinary-real-20261031 refs/remotes/cloudinary-review/live
git push -u origin test/cloudinary-real-20261031
```

Isso importa a correção, os testes e o workflow em uma nova branch. Não há merge, push ou alteração da `main`. O pacote contém também um patch incremental para quem já está em `da1068b`.

Antes de enviar a branch, deixe os quatro secrets e a regra de acesso do ambiente prontos. O push dessa branch dispara automaticamente o teste. Não é preciso acrescentar o workflow à branch principal.

## 5. Acompanhar a execução

Na aba **Actions**, abra **AtendeIA - Cloudinary real isolado**. O fluxo executa somente:

```bash
npm run test:neon-proxy -- --cloudinary
```

A instalação de dependências não recebe chaves dos provedores. A geração do cliente Prisma usa uma URL fictícia e não conecta a banco. As credenciais reais são passadas somente à etapa do teste. Não há `npm test`, suíte PostgreSQL anterior, migrations ou comando de deploy.

O teste faz uma conferência de integridade do banco antes/depois. Essa conferência é uma proteção da rodada Cloudinary, não uma repetição das suítes PostgreSQL já aprovadas.

Ao terminar, o artefato `atendeia-cloudinary-safe-summary` contém somente o resumo: resultado, quantidade de testes, preservação do banco e eventual lista de IDs descartáveis restantes. Ele não contém segredos, respostas completas do provedor, erros detalhados ou snapshots do banco. As actions estão fixadas por SHA, o token tem apenas leitura do conteúdo e o resumo tem retenção de três dias.

Se a execução falhar por configuração ausente, corrija os Environment secrets e use **Re-run all jobs** naquela execução. Não coloque valores em comentários, logs, arquivos de código ou mensagens. O link de uma execução pode ser compartilhado para inspeção dos resultados; ele não deve conter segredos.

## Proteções dos arquivos

A rodada cria duas imagens PNG de um pixel sob IDs novos, com tenant e UUID da rodada. Os uploads usam `overwrite=false`. Antes de excluir, o teste exige correspondência do ID, do asset_id retornado no upload, do tipo e da tag exclusiva da rodada. Não existe exclusão por pasta, prefixo ou em massa.

Os cenários incluem imagem compartilhada, remoção após o último vínculo, isolamento entre empresas, erro 503 induzido antes de um pedido de exclusão real, nova tentativa e recuperação após reconectar o Prisma. O 503 é induzido pelo teste; os demais pedidos válidos vão ao Cloudinary real.

Se um upload for aceito pelo Cloudinary mas a resposta se perder, o identificador tentado fica registrado no manifesto. Sem recibo confiável, o teste não o apaga automaticamente: informa o resíduo para revisão. Arquivos fora do manifesto são recusados.

## O que falta

Cadastrar os secrets no GitHub e publicar a branch de teste com uma conta autorizada. Enquanto isso não ocorrer, os testes reais Cloudinary permanecem não executados. Este pacote não é uma publicação em produção nem uma aprovação final da integração.

Fontes oficiais consultadas: [environments do GitHub](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments), [Environment secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets), [credenciais Cloudinary](https://cloudinary.com/documentation/developer_onboarding_faq_find_credentials) e [variáveis/segredos Render](https://render.com/docs/configure-environment-variables).
