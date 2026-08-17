# Módulo Base de Conhecimento

Produtos, serviços, FAQs e horários pertencem ao tenant e só entram no contexto da IA quando estão ativos. A busca retorna um conjunto pequeno e relevante; o prompt não recebe registros de outras empresas nem o banco completo.

Escritas exigem papel `OWNER`, `ADMIN` ou `MANAGER`. Atualizações e exclusões combinam sempre `id + tenantId`, impedindo acesso por enumeração de UUID.
