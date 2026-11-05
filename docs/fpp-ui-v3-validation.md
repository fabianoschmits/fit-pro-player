# FPP UI V3 — aplicação e validação

Branch: `preview/fpp-ui-v3-20261105`.
Base: `a567a90b7fd6aeeab86f5f2f21197ce306028ebd`.
Pacote: `D:/Nova pasta/fpp_ui_consistency_package`.

Aplicadas as correções V1/V2/V3 nos 58 arquivos existentes e criada a folha de composição `frontend/src/fpp-ui-foundations.css`. Mantidos os controles animados, sprites, rotas, integrações e regras de negócio.

## Incompatibilidades resolvidas no pacote original

- `ProfessionalStudentPage.jsx`: a âncora abreviada correspondia a dois contextos. As regras agora usam o parágrafo completo, separando `HistoricalPlan` (`onClick={load}`) de `StudentProfile` (`onClick={()=>setReload(x=>x+1)}`). Ambos recebem o aviso visual sem trocar seus handlers.
- `Library.jsx`: na reaplicação, a regra de composição inicial não reconhecia o grupo de chips já ampliado com atributos de acessibilidade. A regra agora já produz o grupo acessível completo. A reaplicação real retorna zero arquivos alterados.
- As demais âncoras foram validadas antes da escrita. O CSS de composição respeita as regras existentes de `[hidden]` com `!important`, confirmado no navegador.

## Verificações

- `npm run lint`: aprovado.
- `npm run typecheck`: aprovado.
- `npm run build:vercel`: aprovado, catálogo de 156 exercícios e manifesto PWA verificados. Aviso existente sobre importação estática/dinâmica de sheets.
- `npm test`: 189 arquivos, 1.656 testes aprovados. O ambiente happy-dom emite mensagens de rede/abort em testes; código de saída zero.
- `verify_fpp_screen_coverage.py`: 54/54 arquivos com marcadores e contratos aprovados.
- Teste sintético do aplicador corrigido: check/apply/check aprovados.
- Reaplicação no checkout real: zero alterações.
- Testes novos V3: seis cenários aprovados, incluindo navegação com seções ocultas, lista vazia, falha de consulta, modelo sem versão e modelo válido.
- Matriz de overflow: 20 rotas × cinco larguras (320/360/390/430/1280) × dois temas. Capturas reais em 390px; inspeção visual de Home, Biblioteca e criação de modelos.
- Playwright mobile (gestão, console e modais): 31 aprovados, 12 matrizes exclusivas de desktop ignoradas conforme configuração original. A matriz V3 separada cobre cinco larguras e ambos os temas.
- Editores e seletores de exercícios: quatro larguras aprovadas no projeto desktop; mensagens aprovadas em desktop/mobile.
- Uma execução concorrente inicial disputou a pasta de artefatos do Playwright; o cenário de swipe foi repetido em pasta isolada e passou. Fixtures novas foram corrigidas para incluir o campo obrigatório offset e todos os seis testes V3 passaram na execução final.
- Revisão independente: sem regressões críticas ou importantes.

## Limites da validação

Os testes de navegador usam fixtures e não escrevem em contas reais do Supabase. Não equivalem a testar todos os estados com dados reais nem a validar num aparelho físico. As capturas ficam nas pastas ignoradas de resultados do Playwright.

## Arquivos desta entrega

- `docs/fpp-ui-v3-validation.md`
- `docs/superpowers/plans/2026-11-05-fpp-ui-v3.md`
- `frontend/e2e/ui-v3-consistency.spec.js`
- `frontend/src/components/ManagementLayout.jsx`
- `frontend/src/components/ProfessionalProfileForm.jsx`
- `frontend/src/components/ProfessionalProgramEditor.jsx`
- `frontend/src/components/StudentProfessionalInvite.jsx`
- `frontend/src/components/training/TrainingPlanWorkspace.jsx`
- `frontend/src/components/ui.jsx`
- `frontend/src/experiments/alternative-menus/AlternativeMenus.jsx`
- `frontend/src/experiments/home-glass/HomeGlass.jsx`
- `frontend/src/experiments/workout-players/WorkoutPlayers.jsx`
- `frontend/src/features/console/CommunityModerationPanel.jsx`
- `frontend/src/features/console/ConsoleAccess.jsx`
- `frontend/src/features/console/ConsoleCommunity.jsx`
- `frontend/src/features/console/ConsoleConversation.jsx`
- `frontend/src/features/console/ConsoleFaq.jsx`
- `frontend/src/features/console/ConsoleLaboratory.jsx`
- `frontend/src/features/console/ConsoleLayout.jsx`
- `frontend/src/features/console/ConsoleMessages.jsx`
- `frontend/src/features/console/ConsoleNotifications.jsx`
- `frontend/src/features/console/ConsoleOverview.jsx`
- `frontend/src/features/console/ConsoleProfessionals.jsx`
- `frontend/src/features/console/ConsoleSystem.jsx`
- `frontend/src/features/console/ConsoleUI.jsx`
- `frontend/src/features/console/ConsoleUserPage.jsx`
- `frontend/src/features/console/ConsoleUsers.jsx`
- `frontend/src/fpp-ui-foundations.css`
- `frontend/src/main.jsx`
- `frontend/src/professional.css`
- `frontend/src/sheets.jsx`
- `frontend/src/views/BodyProgress.jsx`
- `frontend/src/views/Community.jsx`
- `frontend/src/views/CommunityMessages.jsx`
- `frontend/src/views/History.jsx`
- `frontend/src/views/Home.jsx`
- `frontend/src/views/Landing.jsx`
- `frontend/src/views/Library.jsx`
- `frontend/src/views/More.jsx`
- `frontend/src/views/MotionFeedback.jsx`
- `frontend/src/views/PersonalData.jsx`
- `frontend/src/views/Plan.jsx`
- `frontend/src/views/PrivacyPages.jsx`
- `frontend/src/views/PrivacySettings.jsx`
- `frontend/src/views/ProfessionalDashboard.jsx`
- `frontend/src/views/ProfessionalInvites.jsx`
- `frontend/src/views/ProfessionalLinkRequestPage.jsx`
- `frontend/src/views/ProfessionalProfile.jsx`
- `frontend/src/views/ProfessionalPrograms.jsx`
- `frontend/src/views/ProfessionalStudentPage.jsx`
- `frontend/src/views/ProfessionalStudentPlan.jsx`
- `frontend/src/views/ProfessionalStudents.jsx`
- `frontend/src/views/RoutineEdit.jsx`
- `frontend/src/views/Settings.jsx`
- `frontend/src/views/Stats.jsx`
- `frontend/src/views/StudentProfessionalDetail.jsx`
- `frontend/src/views/StudentProfessionalMaterials.jsx`
- `frontend/src/views/StudentProfessionals.jsx`
- `frontend/src/views/Support.jsx`
- `frontend/src/views/SupportTicket.jsx`
- `frontend/src/views/SupportTickets.jsx`
- `frontend/src/views/Workout.jsx`
