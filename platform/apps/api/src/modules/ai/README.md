# Módulo IA

O adaptador usa a Responses API com Structured Outputs e `store: false`. O modelo recebe somente o recorte de conhecimento do tenant, histórico recente e a mensagem atual. A saída obedece ao contrato:

`answer`, `canAnswer`, `confidence`, `needsHuman`, `reason`.

Há duas barreiras antes da resposta: contexto relevante precisa existir e a confiança precisa alcançar o limite configurado. Falha, recusa, contexto ausente ou baixa confiança sempre resultam em transferência humana. O prompt trata a mensagem do cliente como entrada não confiável para reduzir prompt injection.
