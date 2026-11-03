# Alternância por semana completa — 2026-11-02

## Comportamento entregue

- Um clique em qualquer dia do calendário profissional abre a confirmação de retirada do plano inteiro, inclusive se houver selo de atualização. Cancelar preserva o plano. Confirmar reutiliza save_personal_library_plan e apply_library_plan com revisão; não apaga dias localmente.
- O resultado confirmado restaura toda a configuração pessoal (semana, modo e descansos), assignedProgram=null, seleção self e rotinas pessoais atuais. O modal fecha após validar a resposta; Meus treinos permanece aberto. O profissional continua na biblioteca para reaplicação.
- Cada plano profissional mostra a semana completa (sete dias, inclusive descanso), todos os treinos e uma única ação Usar este plano/Em uso. Não há paginação que esconda os últimos dias. Alterações por dia continuam acessíveis como detalhes, mas uma confirmação aplica toda a versão, inclusive dias sem alterações.
- O seletor e os previews não mudam o plano ativo. Cabeçalho e calendário principal usam o store confirmado pelo servidor.
- Pronto e Voltar na edição pessoal retornam a /plan?library=self. Editores profissionais preservam callbacks e rotas. Rotinas pessoais continuam editáveis durante uso profissional; a organização de dias pede aplicar Meus treinos antes, evitando misturar a semana ativa profissional.

## Treinador e migration

Nova migration 202611020008_plan_selection_notifications.sql; nenhuma migration anterior foi alterada.

- is_selected nas assignments de professional_client_detail vem da seleção persistida, com escopo do treinador/vínculo e assert_account_active explícito.
- professional_workspace_students mantém a versão anterior selecionada visível enquanto há uma versão nova disponível. Revogação sem substituição ativa continua removendo o plano da projeção de uso.
- Trigger transacional na seleção emite student_plan_selected e student_plan_left pela infraestrutura existente de notification_events/jobs. Entrega/preview não notificam uso; reaplicar a mesma seleção e conflitos não geram avisos duplicados.
- Novos eventos mantêm as preferências, dispositivos, vínculo, escopo e entrega existentes. Push em segundo plano usa texto genérico, sem dados pessoais. A página e lista de alunos recarregam a seleção ao receber aviso em primeiro plano.
- Dispatcher push-dispatch publicado e migration aplicada no Supabase remoto; dry-run confirmou zero pendências.

## Evidências locais

- Regressões reproduzidas antes das correções: semana parcial com sete CTAs/paginação; retirada de um dia; retorno de Pronto à aba profissional; status/avisos de seleção ausentes; atualização de status com página aberta.
- Vitest completo após o último ajuste: 1.623 testes, 186 arquivos, todos passaram (11 testes adicionais).
- Grupo final Plan/PlanLibrary/modal: 59 passaram, incluindo retirada de dia com selo Atualizado.
- Banco PostgreSQL criado do zero: 35/35 arquivos SQL passaram, incluindo todos os guardas de conta e migration 008.
- Harness da biblioteca: 14 suítes passaram, incluindo dez alternâncias, rotinas atuais e novo teste de semana completa/avisos ao treinador.
- E2E direcionado PlanLibrary + alternância: 43 passaram, 6 skips preexistentes da matriz de viewport. Os 27 casos de alternância (nove cenários em três projetos) passaram sem skips. Inclui criação e Pronto durante profissional, retirada integral/cancelamento/reaplicação, reload, concorrência e execução de treino.
- Notificações: 42/42 passaram, com novos tipos cobertos no payload localizado e service worker.
- Lint, typecheck, i18n e fatigue probe passaram. Builds normal, Vercel e mobile/web passaram. PWA: 7/7.

O E2E utiliza o servidor canônico controlado pelas fixtures; SQL executa as funções reais em bancos descartáveis. A instalação limpa, suíte E2E integral e supabase db reset real são repetidos pelo workflow Quality no GitHub. O link e resultado do CI no SHA final são informados na entrega, evitando criar um commit adicional apenas para registrar seu próprio resultado.

## Ajuste após a execução integral do CI

O primeiro CI completo teve 323 E2E aprovados e uma falha: o teste antigo usava getByText('Plano recebido').first(), que passou a encontrar o rótulo compacto (oculto no mobile) do novo calendário de preview antes do cartão do treino. A falha foi reproduzida localmente. O seletor agora aponta explicitamente para o treino recebido visível; também verifica sete dias, um único CTA, fechamento do modal e o dia aplicado no calendário principal. As verificações de ausência de aplicação antes da confirmação foram preservadas.

## Arquivos

- docs/validation/2026-11-02-complete-plan-week.md
- frontend/e2e/application.spec.js
- frontend/e2e/plan-library.spec.js
- frontend/e2e/plan-switching.spec.js
- frontend/public/sw.js
- frontend/src/App.jsx
- frontend/src/components/training/PlanLibrary.jsx
- frontend/src/components/training/PlanLibrary.test.jsx
- frontend/src/components/training/ProfessionalPlanApplyButton.jsx
- frontend/src/lib/native-push.js
- frontend/src/lib/service-worker-push.test.js
- frontend/src/views/Plan.jsx
- frontend/src/views/Plan.switching.test.jsx
- frontend/src/views/ProfessionalStudentPage.jsx
- frontend/src/views/ProfessionalStudentPage.test.jsx
- frontend/src/views/ProfessionalStudents.jsx
- frontend/src/views/RoutineEdit.feedback.test.jsx
- frontend/src/views/RoutineEdit.jsx
- scripts/test-plan-library-database.mjs
- supabase/functions/push-dispatch/web-push.mjs
- supabase/functions/push-dispatch/web-push.test.mjs
- supabase/migrations/202611020008_plan_selection_notifications.sql
- supabase/tests/202611020008_plan_selection_notifications.sql
