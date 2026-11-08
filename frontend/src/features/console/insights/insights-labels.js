const labels = {
 duration_short:'Até 30 minutos',duration_medium:'De 35 a 60 minutos',duration_long:'Mais de 60 minutos',
 start_workout_session:'Iniciar treino',complete_workout_session:'Finalizar treino',save_athlete_plan:'Salvar plano',take_over_workout_session:'Recuperar sessão',abandon_workout_session:'Abandonar treino',
 onboarding:'Configuração inicial',plan_creation:'Criação de treino',workout:'Execução do treino',professional:'Vínculo profissional',photos:'Fotos de evolução',community:'Comunidade',
 runtime_error:'Erro de execução',asset_load_failed:'Falha de recurso',storage_failed:'Armazenamento',service_worker_failed:'Service worker',sync_failed:'Falha de sincronização',sync_recovered:'Sincronização recuperada',operation_slow:'Operação lenta',workout_recovery_failed:'Falha de recuperação',workout_recovery_succeeded:'Sessão recuperada',
 app_open_measured:'Abertura do documento',interface_usable:'Interface disponível após túnel',page_loaded:'Carregamento de página',action_failed:'Falha de operação',action_retried:'Tentativas repetidas',flow_interrupted:'Fluxo interrompido',onboarding_validation_failed:'Validação da configuração',
 flex_adjustment_started:'Revisão FPP Flex',flex_adjustment_completed:'Ajuste FPP Flex aplicado',flex_adjustment_failed:'Falha no ajuste FPP Flex',web:'Navegador',pwa:'PWA',native:'Aplicativo nativo',
 request_professional_link:'Solicitar vínculo',accept_professional_link_request:'Confirmar vínculo',accept_professional_invite:'Aceitar convite',apply_library_plan:'Selecionar plano',send_student_plan:'Disponibilizar plano',
}
export const insightLabel = value => labels[value] || value
