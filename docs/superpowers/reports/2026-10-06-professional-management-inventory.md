# Inventário da gestão profissional e dos treinos

Data: 2026-10-06. Base analisada: `00a2bb0`.
Status: análise antes da implementação. Nenhum arquivo de produto foi alterado nesta etapa.

## Escopo e referência

O pedido envolve gestão profissional, alunos, convites, programas, editor, prescrição, atribuição, acompanhamento e catálogo de exercícios. A imagem enviada orienta densidade, hierarquia e navegação. Identidade de pessoas usa os avatares existentes; não inclui fotografia pessoal, fotos fictícias ou upload de fotos. As áreas pessoais globais do aplicativo continuam com sua experiência atual, com integração controlada nos treinos atribuídos.

## 1. Telas, rotas e funcionalidades existentes

| Tela / URL atual | Funções a preservar | Estados e contexto |
|---|---|---|
| Área profissional `/professional` | Contagem de vínculos ativos, convites pendentes e programas disponíveis; até 10 alunos com atenção; até 5 execuções recentes; convidar, criar programa e abrir alunos/programas | Papel profissional, carregamento, erro/retry, nenhum aluno, nenhuma pendência e nenhuma execução |
| Alunos `/professional/students` | Busca por nome, Todos/Com programa/Sem programa, lista com identidade/programa/última atividade/motivos de atenção; incremento de 30; convidar; escolher aluno para envio | Preserva `program` e `version` no encaminhamento; sem sessão, vazio, nenhum resultado e retry |
| Gestão do aluno `/professional/students/:studentId` | Identidade, avatar, data de vínculo; resumo; programa atual; prescrição; histórico; gerenciamento do vínculo | `section=summary/training/history/relationship`; `version` sem `section` abre treino; conta/aluno e respostas tardias isolados |
| Aluno — treino | Carregar versão atual; escolher programa e versão; revisar prescrição antes de enviar; substituir atribuição; abrir programas; encerrar atribuição com confirmação | Loading/retry das versões independente; envio bloqueado sem vínculo/versão; preserva seção escolhida durante mutação |
| Aluno — histórico | Busca por dia/status/data; incremento de 20; expandir execução; prescrito versus realizado; séries concluídas, carga/unidade, reps, segundos, cardio, esforço, aquecimento, substituição e duração | Vazio/sem resultado; histórico limitado pela projeção atual |
| Aluno — vínculo | Encerrar vínculo com confirmação e explicação do efeito sobre atribuições/acesso | Ação indisponível sem vínculo; erro, pending, navegação após sucesso |
| Convites `/professional/invites` | Listar pendentes; criar código; visualizar resultado; copiar código/link; compartilhar nativo quando disponível; revogar com confirmação | `section=create`, `section=result&code=...`; seleção por código; loading/error/retry; mensagens de cópia; share cancelado não é erro |
| Programas `/professional/programs` | Buscar título/descrição; disponíveis/arquivados; incremento de 20; abrir/criar | Vazio, nenhum resultado, loading/error/retry |
| Criar `/professional/programs/new` | Nome obrigatório até 160; descrição opcional até 2000; cancelar; criar e entrar no editor | Validação, pending, falha sem falsa navegação |
| Programa `/professional/programs/:programId` | Descrição/status; editar metadados; criar versão; versões/data/prescrição; enviar mais recente ou versão específica; comparar; arquivar/restaurar | Programa inexistente, sem versão, confirmação de arquivo, versões preservadas |
| Editor `/professional/programs/:programId/edit` | Metadados; 7 dias com contagem; adicionar/duplicar/remover/reordenar; copiar/trocar dias; publicação | Rascunho local por conta/programa, recuperação, erro de persistência, pending, validação, cancelamento preservando rascunho; cópia sobre dia preenchido confirma |
| Prescrição no editor | Reps/time/cardio; séries; reps ou segundos ou minutos/velocidade; carga; kg/lb; descanso; esforço none/RIR/RPE; superset; notas | Defaults efetivamente gravados; limite de 50 exercícios/dia; avançados recolhidos; publicação falha mantém rascunho |
| Picker profissional | Busca por nome/músculo/equipamento, filtros, miniatura, animação expansível, adicionar múltiplos sem fechar, seleção, contador, incremento de 40 | Uma animação aberta; fallback quando inexistente; nenhum resultado; duplicidade e limite diário bloqueados |
| Perfil `/professional/profile` e `/professional/profile/edit` | Nome/bio/especialidades/localização/registro/verificação; editar; provisionar papel profissional quando necessário | Validação e foco no nome; erro de conexão/permissão; loading/retry; verificação controlada pelo sistema |
| Alias `/professional-profile` | Provisionamento e edição existentes | Preservar links antigos e onboarding |
| Meus profissionais `/student/professionals` | Profissionais vinculados com nome/especialidades/programa; programa atual; próximo treino; iniciar execução; acessar materiais/adicionar profissional | Sincronização da atribuição recebida com store; timeout; retry; isolamento por conta |
| Adicionar `/student/professionals/add` | Digitar código, prévia do profissional, registro/verificação, aceitar vínculo e limpar convite pendente | Sem login, bootstrap de autenticação, convite inválido/expirado/usado, pending, falha, aceitação antes/depois do onboarding |
| Alias `/connect`, `/invite/:code` e query `code` na raiz | Encaminhamento para o mesmo fluxo de prévia/aceite | Preservar código e intenção após login |
| Profissional do aluno `/student/professionals/:professionalId` | Apresentação, registro/verificação, programas recebidos, histórico prescrito/realizado, vínculo | `section=summary/training/history/relationship`; `material=assignmentId` seleciona recebimento exato, inclusive histórico |
| Materiais `/student/professionals/materials` | Programas/prescrições recebidos por profissional; status, versão, data; link para recebimento exato | Até 100 por profissional com vínculo ativo; erro/retry por profissional; não é uma biblioteca de arquivos |
| Biblioteca global `/library` | Catálogo, busca, músculo/equipamento, miniaturas, detalhe com animação, adicionar à rotina, exercícios personalizados locais | Referência de lista; exercício personalizado local não é automaticamente um exercício profissional compartilhável |
| Plano/rotina/execução/histórico pessoais | Rotinas pessoais e atribuídas; início/retomada/conclusão/abandono; execução e histórico | Não redesenhar todo o aplicativo como efeito desta refatoração |

Fontes centrais: `frontend/src/App.jsx:391`, views `ProfessionalDashboard`, `ProfessionalStudents`, `ProfessionalStudentPage`, `ProfessionalInvites`, `ProfessionalPrograms`, `ProfessionalProfile`, `StudentProfessionals`, `StudentProfessionalDetail`, `StudentProfessionalMaterials`; componentes `ProfessionalProgramEditor`, `ProfessionalExercisePicker`, `ProfessionalPrescription`, `StudentProgramOverview`, `StudentProfessionalInvite`; views `Library`, `Plan`, `RoutineEdit`, `Workout`, `History` e `BodyProgress`.

## 2. Componentes, hooks e estado

| Base atual | Papel / decisão para o desenho |
|---|---|
| `AppHeader.jsx` | Já fornece title/subtitle/backTo/action; reutilizar comportamento e compactar apresentação no feature |
| `ManagementLayout.jsx` | Header + sidebar + conteúdo; substituir composição mobile e eliminar navegações simultâneas |
| `ProfessionalWorkspaceNav.jsx` | 5 links; substituir faixa horizontal por navegação própria sem scroll |
| `useManagementNavVisibility.js` | Move scrollLeft para item ativo; aposentar nas novas navegações profissionais; não remover consumidores antigos sem migrá-los |
| `ManagementPanel` | Envelope com borda/radius/padding; substituir por seções planas e SectionHeader |
| `ManagementStatus` / `ManagementEmpty` | Conteúdo semântico reaproveitável em StatusBadge/EmptyState |
| `ManagementAvatar` | Hoje usa iniciais apesar de `avatarRef` disponível nas projeções de alunos; usar catálogo `avatars.js` com fallback de iniciais |
| `ui.jsx` | Button, SearchField, campos, NumberField, controles; preservar interação/foco/áreas tocáveis |
| `Dialog.jsx` / `dialog-focus.js` | Foco, aria-modal, Escape, backdrop, bloqueio de scroll e voltar; preservar na apresentação de sheets |
| `Modals.jsx` / `useUI.openSheet` | Sheet responsiva com presença, dismiss, foco, histórico; base existente, não criar segunda pilha de modais incompatível |
| `Thumb`, `ExerciseGuideAnimation`, `exerciseGuideAsset` | Miniatura/animação real do exercício; reaproveitar assets e lazy loading |
| `ProfessionalPrescription` / `ProfessionalSessionDetail` | Conteúdo de prescrito versus realizado; separar transformação de dados da nova apresentação compacta |
| `useStudentManagementRequest` | Autenticação, timeout, geração de requisições, cleanup e retry; preservar garantias e adaptar novos leitores profissionais equivalentes |
| `useStore` | Estado pessoal e profissional; escopo de conta; gerações de leitura de atribuição; rascunhos locais por conta/programa |
| `professionalProgramDrafts` | Persistência local explícita, excluída do payload de sincronização remota; manter sem prometer sincronização entre dispositivos |
| `assigned-program.js` | Converte versão em rotinas atribuídas e agenda; mantém rotinas pessoais ao remover atribuição; preserva unidades/esforço/superset/notas |
| `professional-events.js` | Outbox offline por conta para iniciar/concluir/abandonar; idempotência e erros permanentes; preservar |
| `App.jsx` | Bootstrap de papel/atribuições, reconciliação com tokens do store, flush de eventos e notificações; não reimplementar dentro de cada nova página |
| `TabBar.jsx` | Barra pessoal global permanece hoje visível em páginas profissionais; definir um único proprietário da navegação por contexto |

## 3. Ações e banco

Repositório central: `frontend/src/lib/professional-workflow.js`. Views não devem consultar credenciais ou usar service role.

| Tabela | Dados e relações |
|---|---|
| `professional_student_relationships` | Profissional/aluno, pending/active/revoked, criação/aceite/revogação; par único; não aceita auto vínculo |
| `professional_invites` | Proprietário, code/link, código/hash, status, expires_at, accepted_at/accepted_by |
| `programs` | Proprietário, título, descrição, archived, created_at, updated_at |
| `program_versions` | Programa, version_number, weekly_plan, criação/publicação |
| `program_assignments` | Programa/versão/profissional/aluno, status e datas |
| `workout_executions` | Atribuição/versão/aluno/dia, status, payload, datas e prescription_snapshot |
| `professional_profiles` | Apresentação, especialidades/região/registro/verificação |
| `profiles` | Nome/avatar públicos usados nas projeções autorizadas |
| `account_snapshots` | Estado pessoal da própria conta; contém medidas, não é fonte de leitura do profissional |

RPCs existentes: `create_professional_invite`, `preview_professional_invite`, `accept_professional_invite`, `revoke_professional_invite`, `revoke_professional_relationship`, `create_program`, `update_program`, `publish_program_version`, `assign_program_version`, `revoke_program_assignment`, `professional_client_summaries`, `professional_client_detail`, `student_program_overview`, `student_professional_summaries`, `student_professional_detail`, `start_workout_execution`, `complete_workout_execution`, `abandon_workout_execution`. O provisionamento usa o repositório próprio de perfil; salvar professional_profiles usa upsert próprio autorizado por RLS (`professional-profile.js:59`), não deve ser tratado como uma RPC de programa.

Invariantes a preservar:

- Programas, versões, atribuições e execuções não aceitam INSERT/UPDATE/DELETE direto do cliente; suas mutações passam por RPC autenticada. Fluxos atuais de convite/vínculo também usam RPC. O save próprio do perfil mantém seu contrato de upsert com RLS.
- Versão publicada é imutável para o cliente; editar produz rascunho e publica versão nova, sem atualizar automaticamente alunos já atribuídos.
- Uma única atribuição ativa global por aluno. Enviar outra versão encerra a anterior, inclusive se pertencente a outro profissional.
- Mesmo envio já ativo é idempotente.
- Arquivar programa encerra suas atribuições; restaurar o programa não reativa alunos automaticamente.
- Desvincular encerra atribuições e acesso do profissional às execuções; aluno preserva histórico pessoal.
- Prescrito/realizado e snapshots históricos não podem virar a prescrição atual por engano.
- Programa/material histórico não substitui nem inicia o programa ativo do aluno.
- Execuções finais não voltam a in_progress; eventos offline continuam vinculados à conta e à execução original.
- Requisições antigas não ressuscitam atribuição removida nem alteram outra conta.

Fontes: migrations `202609240008`, `202609240011`, `202609240012`, `202609240013`, `202610020014`, `202610050015`; respectivas suites SQL em `supabase/tests`.

## 4. Limites e capacidades reais

| Item pedido | Situação atual / necessidade |
|---|---|
| Totais do dashboard | Resumos de alunos limitados a 200; leituras de programas/convites/assignments a 500. Para números exatos, agregar no banco com escopo do caller |
| Atenção | Regras existentes: sem programa, último treino abandonado, aberto >24h ou >=7 dias sem treino; última execução é da atribuição ativa atual, não do histórico inteiro; preservar esse escopo e explicar critérios em ajuda contextual |
| Treinos hoje | Distinguir agenda derivada do plano de execuções realizadas; não afirmar que agenda é treino concluído |
| Programas ativos | Separar disponível (`!archived`) de em uso (atribuições ativas) |
| Frequência | Planejada deriva dos dias da semana; realizada deriva de execuções de período, sem misturar uma com outra |
| Histórico completo | Detail atual entrega até 100 execuções/atribuições, versões até 100. Usar paginação para novos fluxos; não tratar limite como total absoluto |
| Objetivo | Não existe campo estruturado; descrição não deve ser apresentada como objetivo automaticamente |
| Nome do treino | Plano atual é dia → array; não armazena título como Peito + Tríceps. Normalizador descarta metadados extras |
| Duração do programa | Não existe número de semanas; o domínio atual é uma semana recorrente. Não inventar periodização multissemanal |
| Alunos usando programa | Derivar atribuições ativas distintas; agregação evita total limitado e N+1 |
| Última alteração | Máximo entre updated_at do programa e publicação da versão; publicar não atualiza updated_at do programa |
| Duplicar programa | Ainda não existe ação/RPC; compor criar/publicar não é atômico. Prever operação própria sem copiar alunos |
| Observações do profissional | Ainda não existem; notas de exercício são instruções ao aluno, não observações privadas do profissional |
| Medidas/evolução | Medidas pessoais existem; sem projeção/permissão profissional. Evolução das execuções atribuídas já é derivável |
| Convite aceito | Persistido como `active` + accepted_at; na UI pode ser rotulado Aceito |
| Convite expirado | expires_at existe, mas não é lido pelo repo atual; criação atual não define validade. Status expirado deve ser derivado quando houver prazo real |
| Reenviar | Compartilhar/copiar o mesmo código pendente existe. Não há email, envio direto ou histórico de entrega. Expirado exige novo código, não reutilizar um inválido |
| Avatar | avatarRef já existe para aluno; usar catálogo FPP; profissionais sem ref continuam com iniciais |
| Catálogo personalizado | Exercícios personalizados locais existem no app pessoal; não há catálogo profissional remoto nem garantia de assets compartilhados para esses IDs |

Validação do plano: objeto até 512 KiB, 7 dias reconhecidos, 1–50 exercícios por dia; séries 1–50, reps 1–500, carga até 10000, descanso até 3600s, segundos até 86400, minutos até 1440, velocidade até 100, RIR/RPE até 10, notas até 500 e superset até 80. O UI deve orientar sem perder os limites do banco.

## 5. Problemas de estrutura encontrados

1. Duas navegações competem na mesma tela: faixa profissional com 5 destinos e barra pessoal global.
2. `professional.css` define scroll horizontal para navegação profissional, seções do aluno e os 7 dias do editor. Hook corrige visibilidade rolando; isso não resolve clareza.
3. Painéis com padding/borda/radius envolvem listas, e cada prescrição do editor ganha outro card. Poucos itens ficam visíveis no celular.
4. Editor reúne metadados, semana, ferramentas de copiar/trocar, campos básicos, avançados e publicar. O usuário precisa localizar o contexto em uma página longa.
5. Prescrição atual e nova versão inteira aparecem juntas no aluno; confirmação/ação competem com conteúdo.
6. Ações secundárias ficam sempre expostas: copiar/link/share/revogar, duplicar/remover/subir/descer, comparar/arquivar/restaurar.
7. Visibilidade de convites não corresponde a todos os estados do banco; lista padrão somente pendentes.
8. Métricas atuais usam coleções limitadas; a nova UI não pode prometer total exato sem ajuste de dados.
9. Medidas, objetivos, nomes de treinos, notas privadas e duplicação são capacidades diferentes; nenhuma pode ser simulada apenas com CSS.

## 6. Reutilizar, substituir e retirar após migração

- Reutilizar: catálogo e nomes localizados, avatares, mídia/animação, UI controls, foco/voltar de Dialog/sheets, validação, repositórios/RPC, outbox, reconciliação de atribuição, histórico e perfil/provisionamento.
- Substituir: shell profissional mobile, painéis de card, composições de dashboard/aluno/programa/editor/convites, navegação secundária e filas de botões.
- Criar: SectionHeader, CompactList, StudentRow, ProgramRow, WorkoutRow, StatusBadge, EmptyState, SearchBar, FilterChips, BottomActionBar, ContextActions e hooks de leitura/rascunho compartilhados.
- Retirar somente após migração de consumidores: estilos/cards antigos exclusivos da gestão, regras de scroll do nav e useManagementNavVisibility no novo feature. Não remover biblioteca/rotinas pessoais, parâmetros de prescrição ou ações do domínio.

## 7. Verificação disponível

Scripts reais: `npm test`, `npm run build`, `npm run build:vercel`, `npm --prefix frontend run check:i18n`, `npm run check:supabase`, `npm run check:database`, `npm run test:e2e`, `npm audit --prefix frontend --audit-level=high`, `git diff --check`.

Não há script lint/typecheck, config ESLint/tsconfig ou projeto TypeScript de produto. Registrar isso em vez de afirmar checagens inexistentes. Build valida compilação/bundle; não equivale a typecheck estático.

Playwright atual tem Chromium desktop e Pixel 7; viewport de iPhone não significa Safari. Adicionar matriz iPhone 375/390/393/430 com teclado, safe-area, scroll, foco e todos os fluxos. Se WebKit estiver disponível, executar projeto WebKit; se não, identificar a limitação explicitamente.

Testes existentes cobrem domínio/RPC, limites/prescrição, rascunhos, perfil/convites, ações com navegação pendente, dados por conta, atribuições antigas, desvinculação, convite anônimo→login→aceite→onboarding, layout, matriz visual, PWA e execução. Preservar e ampliar para a nova navegação, sheets, títulos de treino, duplicação e dados agregados.

Nesta análise, o agente de banco executou 5 arquivos de testes de domínio: 28 passaram. Isso não valida uma refatoração que ainda não foi implementada. Nenhuma suite SQL ou mutação remota foi executada nesta etapa.

## 8. Proposta vinculada

A proposta de navegação e arquitetura está em `docs/superpowers/specs/2026-10-06-native-professional-management-design.md`, como rascunho para revisão. A implementação deve começar somente após a definição do desenho e do plano de execução.
