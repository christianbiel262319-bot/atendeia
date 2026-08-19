# Módulo WhatsApp

- conecta números somente pela Cloud API oficial da Meta;
- testa o token antes de armazená-lo;
- cifra o access token com AES-256-GCM;
- valida `X-Hub-Signature-256` sobre o corpo bruto;
- resolve o tenant pelo `phone_number_id` cadastrado;
- persiste hash e payload do evento com `tenantId`;
- usa chave única e `jobId` para idempotência;
- responde ao webhook rapidamente e envia o processamento à fila.

O worker de mensagens deve sempre carregar o evento pelo par `id + tenantId`, revalidar o estado da conexão e marcar tentativas. Nenhuma resposta ao cliente pode ser enviada diretamente pelo controller do webhook.

O worker executa a IA somente quando a conversa está `OPEN` e sem responsável.
Mensagens recebidas em `WAITING_HUMAN` ou `WITH_HUMAN` são persistidas e
publicadas em tempo real, sem resposta automática.

Sem segredo do aplicativo ou token de verificação da Meta, a API permanece
operacional para os demais módulos e a conexão retorna
`PROVIDER_NOT_CONFIGURED` com a mensagem “Configuração necessária”.
