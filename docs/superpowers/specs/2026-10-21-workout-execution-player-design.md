# Player real de execução do treino

O usuário escolheu a referência enviada e autorizou criar/aplicar diretamente na página real de execução (`/workout`). O desenho é um player compacto preto/turquesa: nome do treino e séries no topo, segmentos de progresso, card arredondado com animação original, nome/meta do exercício, anterior/próximo e expansão, indicadores de exercícios, controles grandes e CTA principal. Reutilizar os botões interativos do app. Não usar imagens geradas como interface.

Manter todas as funções atuais e os dados reais do Zustand. A.start ainda separa iniciar treino de iniciar série. Play apenas inicia; concluir registra a série em execução; descanso expira/pula e aguarda novo Play. Preservar séries cronometradas e tempo realmente sustentado, cardio, carga/peso corporal/adicional, kg/lb, unilateral, RIR/RPE opcional, aquecimento, supersets, progressão explícita, histórico, troca/adição/remoção, confirmação de carga, encerramento, autosave/offline e recuperação.

Um card principal por exercício atual; supersets mantêm indicação de grupo, escolha de parceiros e alternância automática. Lista completa de exercícios, todas as séries, observações, histórico e justificativa de progressão ficam disponíveis em áreas recolhíveis. Avisos e execução/descanso permanecem visíveis. Os timers e notificações reais existentes continuam responsáveis pelos relógios. Alvos de toque de 44px, foco visível, movimento reduzido, temas/acento e nomes longos preservados, com validação em 320/390px.

Separação: componente `WorkoutExercisePlayer.jsx` apresenta o exercício e reaproveita handlers; `Workout.jsx` continua dono do fluxo/sincronização; CSS próprio com raiz `.workout-player-page` e prefixo `wp-`; testes de comportamento e navegador verificam o fluxo real.
