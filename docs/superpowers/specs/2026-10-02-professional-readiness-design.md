# Fit Pro Player: confiabilidade e experiência profissional

## Autorização e objetivo
O usuário aprovou aplicar integralmente o relatório de auditoria, implementar com agentes e realizar commit/push para master. O produto está em teste: não é necessário preservar dados de clientes antigos. A aprovação prévia substitui novas rodadas de aprovação de spec/plano. Não apagar bancos remotos nem credenciais como consequência dessa dispensa de compatibilidade.

## Arquitetura e decisões
Preservar React 19, Vite, Zustand, Supabase e Capacitor. Separar coordenação de sincronização, fila de execução profissional, controle de diálogo e diagnósticos em módulos pequenos. A única prescrição ativa apresentada por aluno corresponde à única atribuição ativa global; substituir programa encerra atribuição anterior. Revogar vínculo interrompe atribuições e acesso profissional a execuções; histórico pessoal permanece com aluno.

## Contratos de dados
Snapshot usa revisão base local; alterações simultâneas produzem conflito visível sem descartar cópias. Toda resposta verifica identidade/geração. Limpeza local e exclusão de conta são ações distintas. Persistência retorna falha visível, e recuperação nativa escolhe cópia válida mais recente. Backup e snapshot validam formato, tamanho e campos essenciais. Escritas profissionais usam RPCs autenticados com invariantes de proprietário, aluno, programa e versão, limites e idempotência. Fila durável scoped por conta registra início/conclusão/abandono e sobrevive a falhas de rede.

## Produto profissional
Iniciar rotina atribuída por qualquer tela registra sessão. Prescrição é preservada e progressão é opção explícita; descanso/duração/cardio/notas/esforço/grupos mantêm semântica do exercício. Programa tem rascunho recuperável, estado pendente, nome/descrição, publicação, comparação de versão, arquivo e atribuição contextual. Aluno vê versão e atualização de programa. Profissional acompanha prescrito versus realizado e pendências com motivos objetivos. Listas usam busca/paginação ou carregamento limitado.

## Experiência e design
Manter identidade preto/teal e demonstrações como elemento característico. Textos operacionais legíveis, escala 14–16 px para corpo, metadados 12–13 px. Tokens completos, foco visível, controles nomeados, diálogo com foco inicial/restaurado e Escape, fundo inerte, gráficos com alternativa textual e botões semânticos. Desktop profissional pode usar lista/detalhe; mobile continua utilizável a 320 px. Traduções e datas locais consistentes. Mensagens motivacionais opt-in/configuráveis.

## Offline, desempenho e operação
Otimizar imagens com resolução adequada e WebP, mantendo fonte recuperável pelo Git; não alterar identidade da marca. Mostrar sincronização/prontidão offline, preparar mídias essenciais do plano e evitar reload durante treino. Diagnósticos locais não incluem conteúdo pessoal/tokens. CI cobre frontend, guards e banco descartável; eliminar jobs obsoletos. E2E cobre jornadas principais com fixtures locais e mocks de fronteira; teste banco valida RLS/RPC sem produção. Documentar deploy/migrations/mobile e limitações reais.

## Critérios de conclusão
Todos os bugs do relatório têm correção e teste significativo; funcionalidades propostas têm caminho utilizável. Passar testes frontend, guards, i18n, probe, builds web/mobile, auditoria dependências e E2E disponíveis. Revisão independente sem pendência crítica. Git limpo após commit e push master confirmado. Validações que dependam de serviço/dispositivo indisponível são documentadas com evidência, sem alegação falsa de sucesso.
