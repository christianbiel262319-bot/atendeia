# Deploy de produção

## Pré-requisitos

- domínio HTTPS para o frontend/API;
- PostgreSQL com backups e conexão TLS;
- Redis persistente e autenticado;
- credenciais reais de Meta, OpenAI e dos provedores habilitados;
- credenciais de envio transacional (`RESEND_API_KEY` e `EMAIL_FROM`) para verificação e recuperação de acesso;
- endpoints de webhook públicos configurados em cada provedor.

## Sequência

1. Configure as variáveis descritas em `.env.example` usando o cofre de segredos da infraestrutura.
2. Gere segredos aleatórios independentes para JWT, banco, Redis e AES-256-GCM.
3. Execute as migrações com `npm run db:deploy` antes de liberar a nova API.
   A migration de guardas multi-tenant interrompe o deploy caso detecte uma
   relação cruzada preexistente, exigindo saneamento explícito antes de continuar.
4. Inicie uma API, um worker e o frontend; depois escale API/workers horizontalmente.
5. Configure liveness em `/health` e readiness em `/ready` (os aliases
   `/health/live` e `/health/ready` permanecem disponíveis).
6. Cadastre URLs de webhook e valide um evento real de cada provedor em sandbox.
7. Promova o primeiro Super Admin e publique planos reais.

## Gates antes do tráfego

- `npm run build`, `npm run lint` e `npm run test` sem falhas;
- teste real de recebimento e envio no número Meta homologado;
- teste de resposta sem contexto resultando em transferência humana;
- teste de webhook duplicado sem duplicar mensagem ou pagamento;
- teste de restauração do PostgreSQL e indisponibilidade temporária do Redis;
- revisão de CORS, cookies, proxy confiável e políticas TLS do ambiente final.
