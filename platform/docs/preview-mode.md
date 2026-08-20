# Modo Preview seguro

O modo demonstração permite avaliar a interface do AtendeIA antes do provisionamento da API, PostgreSQL, Redis e provedores externos. Ele não substitui a autenticação nem representa um ambiente operacional.

## Garantias de segurança

- A autenticação JWT, refresh token, MFA e autorização reais permanecem inalteradas.
- O acesso DEMO não cria usuário, token, cookie de autenticação, PIN ou credencial universal.
- A sessão DEMO existe somente na aba atual (`sessionStorage`) e só é aceita quando a própria build autoriza o modo Preview.
- Leituras são atendidas por fixtures locais identificadas como `DEMO`.
- Toda mutação que dependeria do backend é bloqueada com `Disponível após conectar o ambiente de homologação`.
- WebSocket, Cloudinary, WhatsApp, OpenAI e cobrança não são acionados no modo DEMO.

## Ambientes

O comportamento padrão de qualquer build é `production`, com autenticação real exclusiva e sem possibilidade de iniciar sessão DEMO.

Para uma build de prévia, as duas variáveis abaixo precisam ser definidas explicitamente:

```text
ATENDEIA_DEPLOYMENT_STAGE=preview
VITE_ATENDEIA_STAGE=preview
VITE_ATENDEIA_PREVIEW=true
```

O script `scripts/assert-preview-safety.mjs` interrompe a build se a flag pública de demonstração for ligada com o estágio `production` ou se os estágios público e privado divergirem.

No servidor de desenvolvimento, o script `dev` declara o estágio `development`. O botão aparece somente quando a verificação de saúde do backend falha.

## Fluxo

1. A tela de login tenta verificar `/health/ready`.
2. Se o backend estiver indisponível e a build permitir Preview, aparece `Entrar no modo demonstração`.
3. A sessão local recebe um perfil OWNER/Super Admin explicitamente identificado como DEMO.
4. Consultas de interface recebem dados locais de demonstração.
5. Formulários continuam validando campos, mas submissões dependentes do servidor são recusadas com a mensagem de homologação.
6. Ao sair, a marca da sessão DEMO é removida.

## Publicação de produção

Não definir as variáveis de Preview. A build padrão executa a proteção em modo `production`, e `canEnableDemoMode` retorna `false` mesmo que alguém tente criar manualmente a chave de sessão no navegador.
