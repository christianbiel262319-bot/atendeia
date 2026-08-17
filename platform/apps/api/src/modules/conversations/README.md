# Módulo Conversas

Listagem, histórico, atribuição, resposta humana e resolução usam `tenantId` em todas as consultas. Agentes não podem responder conversas atribuídas a outra pessoa. Mensagens humanas utilizam o mesmo adaptador seguro da Cloud API e são persistidas antes do envio.

O processamento automático transfere a conversa quando recebe mídia não suportada, quando a IA está desligada, quando não há contexto ou quando a confiança fica abaixo do limite.
