# Módulo Auth

## Sessões

O access token expira em 15 minutos. O refresh token é opaco, fica somente em cookie `HttpOnly` e é armazenado no banco como SHA-256. Cada uso revoga o token atual e cria outro na mesma família. Reutilizar um token revogado encerra toda a família.

O endpoint de refresh exige também um token CSRF em cookie legível e no header `x-csrf-token`. O servidor compara os valores em tempo constante.

## MFA

O MFA usa TOTP RFC 6238. O segredo é criptografado com AES-256-GCM. O último passo utilizado é persistido para impedir replay do mesmo código. O desafio anterior ao MFA dura cinco minutos e não é um access token.

## Auditoria

Cadastro, login, falhas conhecidas de login, logout e alterações de MFA geram
eventos de auditoria. IP e user-agent são registrados somente como hashes com
chave, reduzindo exposição de dados pessoais. Senhas e tokens nunca são
incluídos em logs ou auditoria.
