# Correções de fluxo e mensagens — plano de implementação

Objetivo: corrigir os achados da auditoria autorizados pelo usuário e apresentar mensagens consistentes por erro, sem expor infraestrutura, SQL, tokens ou respostas brutas.

Escopo: fluxos existentes. Manter mensagens específicas já seguras de validação/domínio. Nenhuma publicação, alteração de dados reais ou mudança de credenciais. Trabalhar na branch local de correções; preservar os artefatos da auditoria.

- [x] Mensagens: testar classificação real de erros; implementar catálogo reutilizável e aplicar nas telas/repositórios que exibem erros brutos. Distinguir offline, timeout, sessão, permissão, conflito, validação, arquivo, limite e indisponibilidade. Fallback seguro contextual.
- [x] Produto: regressões para entrada de visitante e retorno à comunidade; seleção desktop no PWA; indicador somente durante execução; restaurar asserção de catálogo inicial sem número arbitrário.
- [x] Verificação: atualizar E2E para duração explícita e UI atual da biblioteca; abrir solicitações recolhidas; selecionar treino em descanso; conferir compactação de perfil sem relaxar o requisito; adicionar traduções.
- [x] Infraestrutura local: eliminar falsos positivos do verificador com testes que continuem detectando vazamentos; compartilhar bootstrap SQL correto; investigar instalação de PostgreSQL e dependências sem atualizações incompatíveis cegas.
- [x] Rodar unitários, lint, tipos, traduções, contratos, banco disponível, builds, E2E e PWA; revisar diff com revisor independente e atualizar relatório.

Registro: auditoria anterior é o baseline vermelho (46 E2E e 2 unitários). As correções serão verificadas primeiro com testes focados e depois com as suítes completas. A criação de branch local preserva a branch original sem exigir outro checkout ou reinstalar dependências.

Resultado: 1.786 unitários; 425 E2E validados (419 na rodada completa + 6 repetidos após atualização do texto esperado; 23 ignorados); 7 PWA; 46 verificações nativas de banco; 18 checkpoints SQL/WASM; lint/tipos/i18n/contratos/notificações/builds aprovados; zero vulnerabilidades reportadas. Relatório completo em `docs/auditoria-fluxos-2026-11-07.md`.

Decisões verificadas: preservar metadados dos erros sem renderizar texto bruto; analisar tokens por sintaxe sem os falsos positivos de comentários/funções independentes; reconstruir a cadeia cronológica real das migrations; substituir o gerador de precache por Node sem mudar seu contrato; usar PostgreSQL isolado e preparar uma migration corretiva para o guard e acesso anônimo da consulta de e-mail. Revisão independente concluída, com dois achados corrigidos e nova verificação das permissões efetivas.
