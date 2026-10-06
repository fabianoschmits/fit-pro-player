# Verificação do gerenciamento profissional

Escopo: perfil profissional, área profissional, alunos, programas e versões, convites, meus profissionais, fichas e materiais recebidos. As demais áreas mantêm o desenho existente.

## Resultado implementado

- Navegação local responsiva e páginas próprias de leitura/edição, criação de programas, biblioteca, convites e fichas.
- Profissionais identificados pelo nome; apresentação, treino, histórico e vínculo separados por profissional.
- Materiais representam programas atribuídos, versões e prescrições existentes. Consultar material histórico não inicia nem substitui o programa ativo.
- Leituras do aluno filtradas pelo chamador e vínculo ativo, sem ampliar a política de leitura dos perfis profissionais.
- Operações pendentes preservam a navegação e o escopo da conta; encerrar vínculo concilia o programa local mesmo após sair da ficha.

## Evidências em 70a5e2c (verificação final em 06/10/2026)

| Verificação | Resultado |
| --- | --- |
| `npm --prefix frontend test` | 108 arquivos, 905 testes passaram |
| `npm --prefix frontend run build` | Build de produção concluído |
| `npm --prefix frontend run check:i18n` | 11 idiomas, 1.423 chaves em cada pacote; português completo |
| `npm run check:supabase` | 23 passaram, 3 testes de execução SQL indisponíveis; limites de acesso estáticos passaram |
| `npm --prefix frontend run test:e2e` | 48 passaram; 8 duplicações da matriz visual ignoradas intencionalmente |
| Navegador | 360, 390, 1280 e 1440 px, claro/escuro, dados sintéticos; 162 imagens finais |
| Inspeção visual | Perfil/formulário, visão geral, editor, materiais, vazio/erro/foco; controles do editor verificados em 360/390 px |

O teste do editor reproduziu um recorte interno antes da correção. A verificação final considera os limites dos controles e do conteúdo interno, além da largura total da página. Início, Plano e Mais foram inspecionados nos dois temas em 390/1440 px para conferir o isolamento do layout.

## Banco e aplicação

A migração `supabase/migrations/202610050015_student_professional_management.sql` foi **aplicada ao Supabase em 06/10/2026**, após autorização explícita do usuário. Projeto configurado no `.env`: **Fpp**, referência `bgqavxoxwgheloeubbpf`, região `sa-east-1`. As credenciais foram carregadas no ambiente dos processos e não foram registradas nos comandos, resultados ou neste relatório.

Verificação remota com Supabase CLI 2.119.0:

- Antes da aplicação, `migration list --linked` e `db push --linked --dry-run` apontaram somente essa migração pendente.
- `db push --linked --yes` concluiu a aplicação sem erros.
- Depois, as 16 migrações locais corresponderam ao histórico remoto; nova simulação retornou `upToDate: true` e nenhuma migração pendente.
- Uma transação somente de leitura confirmou o registro único no histórico, funções presentes, execução concedida a `authenticated` e negada a `anon`, `security definer` com `search_path` fixo e RLS do perfil habilitada.
- As funções foram executadas em verificações sem gravação: ausência de identidade produziu erro de permissão e identidade de prova sem vínculo recebeu resultados vazios. As requisições REST anônimas para ambas as funções retornaram HTTP 401 / SQLSTATE `42501`.

A instalação local do PostgreSQL continua sem `postgres.bki`; a suíte completa com dados de teste em banco descartável não foi executada. As verificações remotas acima são testes básicos de execução e permissões, não substituem a suíte completa de isolamento com múltiplos usuários. Os testes de navegador continuam usando dados sintéticos.

## Decisões de implementação

1. Cada ficha lê até 100 materiais e 100 execuções recentes. Registros mais antigos exigirão paginação futura.
2. Vínculo indisponível retorna uma ficha ausente; ausência de autenticação retorna erro de permissão. A interface informa indisponibilidade sem expor dados.
3. O resumo mostra o programa atual e um próximo treino; prescrição completa e histórico exigem abrir a ficha. O componente existente mantém seu comportamento padrão fora dessa variante.
4. Links de material usam o identificador da atribuição no parâmetro `material`; esse parâmetro precisa ser preservado para abrir a versão escolhida.
5. `/connect` e a página de adicionar preservam a intenção durante o login, mesmo sem código. Essa ação pode ocorrer antes do onboarding pessoal, como o fluxo existente de convite; a visão geral sem código mantém o onboarding normal.

## Revisão

As cinco etapas passaram por revisão independente, com regressões de contexto e sincronização corrigidas e revisadas. A revisão final do conjunto e a revisão focada das correções foram aprovadas. A regressão de leitura atrasada foi reproduzida com aplicativo, armazenamento real e ficha integrados; a revisão compartilhada da atribuição impede restaurar treino revogado ou sobrescrever um programa mais recente. O teste contínuo de autenticação/aceite e a navegação do link antigo de convite também foram aprovados. Código mantido localmente, sem publicação do frontend; a migração foi aplicada remotamente na etapa autorizada em 06/10/2026.
