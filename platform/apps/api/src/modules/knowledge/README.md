# Módulo Base de Conhecimento

Produtos, serviços, FAQs, informações da empresa, horários semanais e exceções
pertencem ao tenant. Somente itens `ACTIVE` entram na recuperação da IA;
rascunhos e arquivados permanecem fora do contexto.

## Capacidades

- produtos, serviços e FAQs paginados por cursor, com pesquisa e status;
- categoria, preço, duração, disponibilidade e ordenação quando aplicável;
- perfil oficial com descrição, endereço, contatos, políticas e links HTTP(S);
- horários por dia e exceções por data;
- imagem de produto vinculada a um `MediaAsset` do mesmo tenant;
- CRUD auditado e interface com estados de loading, erro, sucesso e vazio.

A recuperação lexical consulta no máximo dez registros relevantes por tipo. O
perfil da empresa só é incluído quando a pergunta corresponde a um campo
realmente preenchido. Consultas sobre horários incluem a semana e as próximas
exceções; nenhuma credencial ou item de outro tenant é enviado ao modelo.

Escritas exigem papel `OWNER`, `ADMIN` ou `MANAGER`. Atualizações e exclusões
combinam sempre `id + tenantId`. A imagem possui chave estrangeira composta
contra `MediaAsset(tenantId, id)`, impedindo vínculo cruzado no banco.
