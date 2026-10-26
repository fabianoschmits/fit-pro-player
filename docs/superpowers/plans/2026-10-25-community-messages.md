# Mensagens privadas da comunidade

Objetivo: conversas individuais acessíveis pelo sino da comunidade e pelo perfil de outro usuário; caixa de entrada inspirada na referência, chat com as classes visuais do suporte.

1. Criar migração transacional com mensagens privadas, índices, RLS, RPCs autenticadas para envio idempotente, histórico paginado, caixa de entrada e leitura. O remetente deriva de auth.uid(); terceiros não podem consultar conversas. Limite de 3000 caracteres e proteção contra envio excessivo no servidor.
2. Criar repositório e testes para validação, falhas e combinação de páginas.
3. Implementar caixa de entrada, busca, contador, estados vazios/erro e chat com paginação, atualização periódica e ao retornar à janela. Reutilizar CSS do suporte. Preservar rascunho quando envio falhar.
4. Integrar rotas e botões da comunidade. Validar testes e build.
5. Conferir projeto Supabase vinculado e migrações pendentes; aplicar somente a migração desta funcionalidade e verificar objetos e permissões. Registrar qualquer limitação de acesso sem alegar execução.

Escopo: texto, conversas individuais; sem grupos, chamadas ou anexos.
