# AtendeIA V2 — Auditoria e estabilização da Fase 1

Data da auditoria: 19 de agosto de 2026.

## Escopo e método

Foram inspecionados o frontend publicado, o frontend React/Vite canônico, a API
Express, rotas, controllers, services, validações, Prisma, migration inicial,
PostgreSQL, Redis, BullMQ, WebSocket, Docker, variáveis de ambiente, integrações,
testes, documentação e todos os controles interativos visíveis.

Classificações usadas:

- **FUNCIONAL:** possui fluxo coerente de UI/API/persistência e controles básicos;
- **PARCIAL:** existe, mas não cumpre todos os critérios de pronto da V2;
- **MOCK:** comunica uma capacidade sem executar o fluxo real;
- **QUEBRADA:** possui defeito que impede ou torna inseguro o uso esperado;
- **NÃO IMPLEMENTADA:** não há fluxo utilizável.

## Matriz de funcionalidades

| Área | Estado | Evidência e limitação principal |
|---|---|---|
| Infra Docker | PARCIAL | PostgreSQL, Redis, API, worker, migration e web estão definidos; execução integrada ainda não foi validada neste ambiente. |
| Banco e Prisma | PARCIAL | Migration e modelos multi-tenant existem; faltam constraints compostas para impedir relações cruzadas entre tenant no próprio banco. |
| API modular | FUNCIONAL | Módulos, controllers, services, schemas Zod e tratamento central de erros estão separados. |
| Cadastro | FUNCIONAL | Cria tenant, usuário OWNER, associação, auditoria e sessão em transação. |
| Login | FUNCIONAL | Senha com bcrypt, lockout, seleção de tenant e MFA estão implementados. |
| Logout | FUNCIONAL | Revoga refresh token, limpa cookies e registra auditoria. |
| Refresh rotativo | FUNCIONAL | Hash, família, rotação atômica e detecção de reutilização estão implementados. |
| MFA | FUNCIONAL | TOTP criptografado, confirmação e bloqueio de replay por time-step. |
| Recuperação de senha | NÃO IMPLEMENTADA | Não existem token, rotas, serviço ou telas. |
| Verificação de e-mail | NÃO IMPLEMENTADA | Não existem estado, token, envio ou telas. |
| Gestão de sessões | NÃO IMPLEMENTADA | Não há listagem e revogação seletiva de sessões. |
| Isolamento por sessão | FUNCIONAL | `tenantId` é derivado do JWT e validado contra associação e tenant ativos. |
| Isolamento por consulta | PARCIAL | Serviços operacionais filtram por tenant; faltam testes com banco e constraints relacionais compostas. |
| Onboarding | PARCIAL | Progresso é derivado de dados reais, mas não possui histórico persistido nem UI completa por etapa. |
| WhatsApp — conexão | PARCIAL | Valida token na Meta e criptografa segredo; faltam desconexão, reconexão, sincronização e fluxo guiado. |
| WhatsApp — webhook | FUNCIONAL | Corpo bruto, HMAC, identificação por Phone Number ID, deduplicação e BullMQ estão implementados. |
| WhatsApp — anexos | PARCIAL | Mensagem não textual é persistida como marcador e transferida; mídia e metadados não são armazenados. |
| Base de conhecimento | PARCIAL | CRUD de API para produtos, serviços e FAQs e upsert de horários; UI não edita itens e faltam categorias, empresa e exceções. |
| Configuração da IA | PARCIAL | Liga/desliga, tom, confiança, fallback e contexto persistem; faltam nome, idioma, regras, instruções e critérios completos. |
| Contrato da IA | FUNCIONAL | `answer`, `canAnswer`, `confidence`, `needsHuman` e `reason`, com política de confiança e fallback seguro. |
| Grounding da IA | PARCIAL | Recupera somente conhecimento ativo do tenant; busca lexical simples e sem simulador/evals de produção. |
| Simulador da IA | NÃO IMPLEMENTADA | Não existem endpoint nem interface “Testar minha IA”. |
| Conversas — lista/chat | PARCIAL | Lista, histórico, envio humano, resolução e atualização WebSocket existem; faltam paginação, anexos e terceira coluna. |
| Conversas — controle humano | PARCIAL | Atribuição e estados existem; faltam assumir, transferir, devolver à IA, reabrir e UX móvel dedicada. |
| Contatos/CRM | PARCIAL | Lista, busca e edição de nome/e-mail/tags; faltam criar, arquivar/excluir, notas, origem e timeline. |
| Equipe | PARCIAL | Lista, convite, aceite, alteração e desativação existem; faltam reenvio, revogação/listagem de convites e onboarding de convidado novo. |
| RBAC | PARCIAL | Backend restringe módulos e bloqueia elevação por ADMIN após estabilização; ainda falta uma matriz central de permissões e testes HTTP. |
| Dashboard | PARCIAL | Totais reais e onboarding existem; faltam janela temporal, tempo médio, tendências, atividade e saúde autenticada. |
| Billing | PARCIAL | Catálogo real, checkout/cancelamento e webhooks de três provedores existem; faltam uso, limites e validação E2E com contas reais. |
| Cloudinary | PARCIAL | Assinatura, registro e remoção existem na API; não há fluxo de upload no frontend. |
| Configurações | PARCIAL | Apenas MFA possui experiência utilizável. |
| Super Admin | PARCIAL | Overview, tenants, status e planos existem; faltam paginação robusta, auditoria consultável e operações adicionais. |
| Frontend React/Vite | PARCIAL | Usa Router, Query, RHF e Zod com API real; faltam design system V2, estados consistentes e testes de fluxo. |
| Frontend publicado | MOCK | A publicação Sites é uma camada visual separada, sem API. Após a auditoria, ações de negócio foram desativadas e a limitação ficou explícita. |
| Responsividade | PARCIAL | Layout base e drawer móvel existem; conversas, tabelas e formulários ainda não têm UX móvel completa. |
| Acessibilidade | PARCIAL | Há labels, foco básico e redução de movimento; faltam auditoria WCAG, dialogs acessíveis e navegação completa por teclado. |
| Observabilidade | PARCIAL | Pino, request ID e auditoria existem; faltam métricas, tracing, alertas e política operacional de retenção. |
| Testes | PARCIAL | Unitários passam; faltam integração com PostgreSQL/Redis, HTTP, frontend e E2E. |
| Deploy de produção | NÃO IMPLEMENTADA | Docker está preparado, mas não há ambiente real configurado, migração validada, observabilidade e smoke test externo. |

> Atualização da Fase 2: a duplicação visual foi removida. O adaptador de
> hospedagem agora importa diretamente o frontend canônico. A publicação da API,
> PostgreSQL, Redis e worker continua pendente e, portanto, o deploy completo
> permanece classificado como não implementado.

## Mocks e controles auditados

Antes da unificação, o frontend publicado continha navegação, busca, notificações, configuração,
onboarding e links de WhatsApp sem ação de negócio. Esses controles foram
desativados e acompanhados por um aviso explícito de que a API não está
conectada.

No frontend canônico:

- o botão “Configurar atendimento” agora navega para a configuração real;
- busca global e notificações sem backend foram removidas do cabeçalho;
- integrações sem segredo exibem **Configuração necessária**;
- ações de equipe refletem as permissões OWNER/ADMIN/AGENT;
- permanecem parciais: confirmação de exclusão do conhecimento, feedback de
  clipboard, toasts globais, menu rápido “+” e vários estados skeleton.

## Falhas críticas encontradas e estabilização

1. **IA respondia durante atendimento humano.** O worker agora executa IA apenas
   em conversa `OPEN` e sem responsável; estados humanos apenas persistem e
   publicam a nova mensagem.
2. **Elevação de privilégio por ADMIN.** A política agora impede ADMIN de criar
   outro ADMIN, alterar OWNER, editar a própria função ou promover AGENT.
3. **Dependência rígida de credenciais externas.** OpenAI e Meta deixaram de ser
   pré-requisitos para iniciar a API. A capacidade fica bloqueada com erro
   explícito e status seguro até a configuração real existir.
4. **Ações sensíveis sem auditoria suficiente.** Logout, falha de login,
   atribuição, transferência, mensagem humana e resolução passaram a registrar
   eventos sem senha ou token.
5. **Controles publicados sem ação.** Foram inicialmente desativados e a camada
   duplicada foi removida no início da Fase 2.

## Principais riscos remanescentes

| Prioridade | Risco | Tratamento planejado |
|---|---|---|
| Resolvida na Fase 2 | Frontend publicado não era o frontend canônico | A entrega visual foi unificada; ainda é necessário hospedar API Express/PostgreSQL/Redis. |
| Crítica | Ausência de teste real Empresa A × Empresa B | Criar suíte de integração com PostgreSQL isolado antes de marcar multi-tenancy como validada. |
| Alta | Relações de banco podem referenciar IDs de outro tenant | Adicionar chaves/uniques compostas e migration segura. |
| Alta | Convite não cadastra novo usuário sem criar empresa própria | Criar fluxo público de aceite/cadastro vinculado ao convite. |
| Alta | Envio outbound é síncrono e a fila outbound não é consumida | Implementar worker, idempotência de envio e retry controlado. |
| Alta | Recuperação de senha, e-mail e sessões ausentes | Completar na Fase 3. |
| Média | Busca lexical da IA é limitada | Evoluir recuperação e criar simulador/evals na Fase 5. |
| Média | Consultas usam limite sem cursor em vários módulos | Padronizar paginação por cursor. |
| Média | Testes de frontend e E2E praticamente ausentes | Adicionar por fluxo nas fases correspondentes. |

## Plano da Fase 2 — Design System V2 e navegação

1. Declarar `platform/apps/web` como frontend único e remover a duplicação visual
   da publicação.
2. Criar tokens centralizados para cor, espaçamento, raio, sombra, tipografia e
   motion, com suporte a contraste e redução de movimento.
3. Organizar a sidebar nos grupos Visão geral, Atendimento, Inteligência, Gestão
   e Sistema; implementar collapse desktop, drawer móvel e tooltips.
4. Implementar menu rápido “+” somente com ações existentes e autorizadas.
5. Criar componentes compartilhados para skeleton, empty, error, success,
   confirmação, toast, badge e estado de integração.
6. Remover ou bloquear qualquer controle sem destino real.
7. Validar desktop, tablet, mobile, teclado, lint, tipos, testes e build antes de
   iniciar a Fase 3.

## Critério de saída da Fase 1

A Fase 1 estabiliza a base e documenta a realidade; ela não declara o MVP
concluído. Multi-tenancy, integrações externas e deploy permanecem **não
validados em produção** até existirem testes integrados e credenciais reais.
