# Mídia

Fornece uploads diretos e assinados para o Cloudinary. Cada arquivo usa a pasta
`atendeia/{tenantId}`; a API valida a assinatura da resposta do provedor antes de
registrar o ativo no banco e aplica novamente o filtro de tenant ao listar/remover.
