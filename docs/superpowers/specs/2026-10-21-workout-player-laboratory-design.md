# Laboratório de players de treino

Pedido: dez exemplos interativos, bem diferentes entre si, dentro do administrador do FitProPlayer. A foto enviada é o estado atual a substituir, não um modelo visual a reproduzir.

Uma nova página em `/console/laboratory/players`, protegida pelo acesso administrativo existente, será ligada ao catálogo do laboratório. Toda a interface será React/CSS/SVG; imagens conceituais não serão usadas como interfaces. Os dez modelos devem mostrar a demonstração animada real do exercício, reutilizando os sprites revisados do app, com controle independente para pausar e reproduzir. A execução da série inicia a animação; a preferência por movimento reduzido desliga movimentos decorativos. A demonstração funcional solicitada continua disponível e pode ser pausada.

Os dez conceitos são Órbita, Console, Cartaz, Percurso, Deck, Haltere, Sprint, Foco, Cabine e Placar. Devem diferir em composição, tipografia, forma e organização dos controles, além da paleta. Um controlador local compartilhado permite comparar o mesmo estágio entre os visuais.

A demonstração inclui três exercícios curtos com animação revisada (Barra fixa, Remada baixa e Sustentação em L; peso corporal, carga e isometria), preparação com contagem de três segundos e aviso para executar, execução com tempo de série, tempo total do treino, registro, descanso com contagem real, ajustes de menos/mais quinze segundos e opção de pular, aviso de fim do descanso, conclusão do exercício, próximo exercício e resumo final. Avisos sonoros são opcionais, iniciados pela interação do administrador. Repetições, carga e RIR são editáveis quando aplicáveis. Histórico local permite conferir os registros. Reiniciar permite repetir a experiência. Atalhos de estágio permitem inspecionar todos os estados rapidamente.

Nenhum dado será enviado ao backend ou escrito na sessão real do aluno. Preservar a proteção administrativa, navegação existente, foco visível, alvos de toque de 44 px, largura móvel de 360 px e preferência por movimento reduzido. Não adicionar dependências.

Verificação: testes do fluxo e proteção administrativa, suite Vitest, build Vite e teste de navegador dos dez conceitos em desktop e celular, com inspeção visual.
