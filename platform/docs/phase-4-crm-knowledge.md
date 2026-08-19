# AtendeIA V2 — Fase 4: contatos e conhecimento

## Resultado

A Fase 4 substitui os fluxos parciais de CRM e conhecimento por operações reais
de UI, API, serviço e PostgreSQL. Nenhum dado de negócio novo é mantido apenas
em estado React ou `localStorage`.

## CRM

- cadastro manual com telefone internacional E.164;
- identidade compatível com o `wa_id`, evitando duplicação quando a conversa
  chegar posteriormente pelo WhatsApp;
- busca com debounce, paginação por cursor e filtros de origem, tag e arquivo;
- edição de nome, e-mail, tags e telefone de contatos manuais;
- telefone de origem WhatsApp protegido contra edição que quebraria a
  sincronização;
- notas internas com autoria, exclusão autorizada e limite de tamanho;
- ficha com últimas conversas e última interação;
- arquivamento somente sem conversa ativa, restauração manual e restauração
  automática por nova mensagem;
- ações auditadas e isoladas pelo tenant da sessão.

## Base de conhecimento

- produtos, serviços e FAQs com CRUD, edição, status, categorias e paginação;
- preço, duração e disponibilidade comercial quando aplicáveis;
- informações oficiais da empresa: descrição, endereço, contatos, políticas e
  links seguros HTTP(S);
- horários semanais e exceções por data com criação, edição e exclusão;
- upload de imagem de produto pelo fluxo assinado do Cloudinary;
- estado explícito **Configuração necessária** quando o Cloudinary não possui
  credenciais no servidor;
- nenhuma chave do Cloudinary é enviada ao frontend; apenas assinatura curta de
  upload, `cloudName` e chave pública;
- remoção de mídia em uso é bloqueada antes de chamar o provedor.

## Grounding da IA

O contexto continua limitado ao tenant e agora também contempla categoria,
disponibilidade, perfil da empresa e exceções de horário. O perfil só conta como
contexto suficiente quando a pergunta corresponde a um campo preenchido. A
consulta sem termos não usa UUID inválido nem envia o catálogo completo.

## Isolamento no banco

A migration `20260819110000_crm_knowledge_expansion` adiciona:

- chave composta entre nota e contato;
- chave composta entre nota e associação do autor;
- chave composta entre imagem de produto e mídia;
- origem, última interação e arquivamento do contato;
- perfil da empresa e exceções de horário.

A suíte PostgreSQL embutida tenta criar nota e imagem cruzadas entre Empresa A e
Empresa B e exige falha do banco.

## Permissões

| Ação | OWNER | ADMIN | MANAGER legado | AGENT | VIEWER |
|---|---:|---:|---:|---:|---:|
| Ler contatos e conhecimento | Sim | Sim | Sim | Sim | Sim |
| Operar contatos e notas | Sim | Sim | Sim | Sim | Não |
| Excluir nota de outro autor | Sim | Sim | Sim | Não | Não |
| Alterar conhecimento | Sim | Sim | Sim | Não | Não |

## Validação

- API: 17 arquivos, 50 testes;
- frontend: 3 arquivos, 10 testes;
- total da plataforma: 60 testes;
- migrations executadas em PGlite/PostgreSQL;
- lint e TypeScript sem erros;
- builds de API, frontend Vite e adaptador Sites concluídos;
- teste de renderização do artefato Sites concluído.

## Limites honestos

- upload de imagem depende de credenciais reais do Cloudinary;
- o teste visual autenticado temporário não foi usado como critério de aceite
  porque o ambiente não possuía Redis; ele foi removido sem entrar no produto;
- ainda faltam testes E2E em navegador contra PostgreSQL e Redis gerenciados;
- a API, o worker, PostgreSQL e Redis ainda precisam de hospedagem própria para
  o frontend publicado operar com dados reais.
