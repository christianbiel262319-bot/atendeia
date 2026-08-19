# Módulo Auth

## Sessões

O access token expira em 15 minutos. O refresh token é opaco, fica somente em cookie `HttpOnly` e é armazenado no banco como SHA-256. Cada uso revoga o token atual e cria outro na mesma família. Reutilizar um token revogado encerra toda a família.

O endpoint de refresh exige também um token CSRF em cookie legível e no header `x-csrf-token`. O servidor compara os valores em tempo constante.

O usuário pode consultar sessões ativas, encerrar uma sessão específica ou
revogar todas as outras. O banco guarda somente hashes de IP/user-agent e um
rótulo genérico de dispositivo; nunca guarda ou devolve o refresh token.

## Recuperação e verificação

Links de redefinição de senha e verificação de e-mail usam tokens aleatórios de
uso único armazenados somente como SHA-256. Redefinir a senha revoga todas as
sessões. A solicitação de recuperação sempre devolve a mesma resposta, exista ou
não uma conta, evitando enumeração.

O envio transacional usa a API do Resend somente quando `RESEND_API_KEY` e
`EMAIL_FROM` estão configurados. Sem essas variáveis, a capacidade é informada
como **Configuração necessária** e nenhum token é exposto pela API.

Convites autenticam o destinatário pelo token e pelo e-mail. Uma pessoa sem
conta pode criar seu usuário diretamente no tenant convidante, sem criar uma
empresa paralela. A posse do convite entregue por e-mail confirma o endereço.

## MFA

O MFA usa TOTP RFC 6238. O segredo é criptografado com AES-256-GCM. O último passo utilizado é persistido para impedir replay do mesmo código. O desafio anterior ao MFA dura cinco minutos e não é um access token.

## Auditoria

Cadastro, login, falhas conhecidas de login, logout, redefinição de senha,
verificação de e-mail, sessões e alterações de MFA geram
eventos de auditoria. IP e user-agent são registrados somente como hashes com
chave, reduzindo exposição de dados pessoais. Senhas e tokens nunca são
incluídos em logs ou auditoria.
