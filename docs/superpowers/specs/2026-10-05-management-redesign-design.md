# Redesenho do gerenciamento de usuários e profissionais

## Objetivo e escopo aprovado

Refazer Perfil profissional, Área profissional e Meus profissionais para facilitar a consulta e o gerenciamento de dados, alunos, vínculos e materiais de treino. A experiência deve ser consistente, moderna e confortável no celular e no desktop.

O escopo inclui as telas de perfil profissional, painel profissional, alunos, detalhe de aluno, convites, programas, versões, profissionais vinculados, detalhe de profissional e aceite de convite. As alterações no menu Mais se limitam aos acessos a essas áreas.

Início, planejamento pessoal, execução de treino, estatísticas, evolução corporal, histórico pessoal, biblioteca geral, configurações gerais e landing page permanecem com seu desenho atual. Não haverá mudança global de navegação, tipografia ou tema. Componentes compartilhados só receberão extensões opcionais; estilos novos serão restritos ao gerenciamento.

## Direção visual

Uma área de acompanhamento esportivo organizada em pessoas, prescrições e relações. O conteúdo e as ações orientam a composição: listas para comparar alunos, fichas para consultar pessoas, editor focado para preparar programas e histórico para acompanhar execuções.

- Base: preto `#000000` no tema escuro e cinza frio `#eef2f6` no claro.
- Superfície: `#1c1c1e` no escuro e branco `#ffffff` no claro.
- Destaque: verde petróleo `#0F8B8D`, respeitando o destaque escolhido pela conta e o token `--on-acc`.
- Texto: os tokens existentes de primeiro e segundo níveis, sem sobrescrevê-los globalmente.
- Tipografia: família de sistema atual, títulos de 24–32 px, subtítulos de 18–20 px, texto de 15–16 px e metadados de pelo menos 12 px.
- Hierarquia: título, contexto curto e ação principal; depois navegação local e conteúdo. Evitar formulários extensos na entrada das áreas e métricas redundantes.
- Usar ícones existentes, divisórias e agrupamentos com propósito. Não criar banners decorativos, imagens de banco ou números fictícios.

No celular, o conteúdo ocupa a largura disponível e as ações têm alvos mínimos de 44 px. A navegação local é compacta, com seleção perceptível, rolagem horizontal quando necessária e retorno contextual nas subpáginas. A barra principal existente é preservada.

No desktop, somente a área de gerenciamento ganha uma navegação lateral local e conteúdo de até aproximadamente 1120 px. As fichas usam duas colunas quando isso facilita leitura, sem esticar formulários ou textos. Entre 768 e 1023 px, usar uma composição intermediária que preserve espaço para o conteúdo.

## Arquitetura de informação

As rotas atuais continuam válidas. Novas subpáginas usam URLs estáveis, de modo que atualizar a página e voltar no navegador preservem o destino e a seção selecionada.

### Área profissional

- `/professional`: resumo de alunos, pendências e atividade, com caminhos claros para gerenciar pessoas, convites e programas. Métricas usam dados reais; não supor que uma execução pertence a um aluno quando a resposta não informar essa relação.
- `/professional/students`: listagem de alunos ativos com nome, programa atual, último treino, busca, filtros e paginação existentes.
- `/professional/students/:studentId`: ficha do aluno. Resumo, Treino, Histórico e Vínculo têm estado refletido na URL por `section`. Os parâmetros existentes `program` e `version` continuam funcionando para o envio de uma versão escolhida.
- `/professional/invites`: lista de convites e acesso à criação. Separar geração/resultado do convite da lista de convites pendentes; conservar cópia, compartilhamento e revogação explícita.
- `/professional/programs`: biblioteca de programas primeiro, busca e distinção entre disponíveis e arquivados. A criação fica em uma subpágina própria.
- `/professional/programs/new`: criação de programa e entrada no editor após sucesso.
- `/professional/programs/:programId`: dados do programa, versões publicadas, comparação e ações de envio ou arquivamento.
- `/professional/programs/:programId/edit`: editor de uma nova versão, com rascunho local existente e saída explícita.
- `/professional/profile`: ficha do perfil com apresentação, especialidades, localização e registro claramente separados.
- `/professional/profile/edit`: edição organizada em grupos de dados; salvar, cancelar e feedback explícitos.
- `/professional-profile`: entrada compatível com o fluxo existente, incluindo `onboarding=1`. O usuário sem capability pode criar seu perfil; o usuário profissional acessa a ficha e a edição.

A navegação lateral/local é a mesma no painel, alunos, convites, programas e perfil. A ficha do aluno e o editor têm também navegação contextual para o pai.

### Área do aluno: Meus profissionais

- `/student/professionals`: entrada com profissionais vinculados identificados, resumo do treino ativo e acesso aos materiais recebidos. Adicionar profissional será uma ação de destaque, sem ocupar o início com um formulário.
- `/student/professionals/add`: código do convite, prévia do profissional e aceite explícito. O código vindo de deep link continua disponível.
- `/student/professionals/:professionalId`: ficha do profissional vinculado com apresentação, especialidades, localização e registro, quando existentes. Separar dados do profissional das informações sobre o vínculo.
- `/student/professionals/:professionalId?section=training`: prescrição recebida e informações da atribuição, sem confundir programas de profissionais diferentes.
- `/student/professionals/:professionalId?section=history`: execuções pertinentes ao profissional selecionado, com prescrito versus realizado quando disponível.
- `/student/professionals/:professionalId?section=relationship`: datas e estado do vínculo; encerramento exige a confirmação existente.
- `/student/professionals/materials`: programas/prescrições recebidos dos profissionais com vínculo ativo, agrupados por profissional e com indicação de atribuição ativa ou encerrada. Cada item abre seus detalhes. Não oferecer início de treino para atribuição encerrada. Vínculos encerrados não aparecem nesta biblioteca; seu histórico pessoal permanece nos destinos existentes.
- `/connect` e `/invite/:code`: manter compatibilidade com os destinos existentes, autenticação e contexto do convite.

Os materiais deste escopo são programas, versões, prescrições e instruções de exercícios já persistidos. Não inclui upload ou armazenamento de PDFs, anexos e documentos.

## Dados e limites de acesso

Preservar React/PWA, Supabase Auth, PostgreSQL, RLS e os repositórios existentes. Não consultar tabelas de domínio diretamente dentro das telas.

Os registros de vínculo atuais não contêm o nome do profissional, e a política de leitura de `professional_profiles` é limitada ao proprietário. Para exibir fichas reais de todos os profissionais vinculados, acrescentar consultas RPC de leitura específicas para o aluno autenticado:

- Um resumo dos profissionais com vínculo ativo, incluindo apenas apresentação profissional, informações públicas de registro e datas do vínculo.
- Um detalhe limitado ao profissional selecionado e ao aluno de `auth.uid()`, incluindo seus programas atribuídos e execuções pertinentes.

As consultas não recebem um identificador arbitrário de aluno. Devem exigir autenticação, verificar o vínculo e retornar somente registros do solicitante. Não expor email, senha, papéis de conta ou dados de outros alunos. Não ampliar a política geral de leitura de perfis profissionais.

As consultas usam `search_path` restrito, concessão de execução apenas a `authenticated` e testes de isolamento. Vínculo encerrado não concede acesso posterior à ficha do profissional. O histórico pessoal que já foi preservado continua seguindo os contratos existentes.

O aplicativo já sincroniza uma única atribuição ativa com o plano pessoal. Preservar `assignedPlanToState`, `clearAssignedProgramFromState`, `startFlow` e a regra de apenas uma atribuição ativa por aluno. A página de materiais não substituirá o plano atual pela seleção de uma prescrição antiga.

Preservar criação e aceite de convite, criação e atualização de programa, publicação de versões, atribuição, encerramento e arquivamento através dos contratos existentes. Não alterar regras de verificação profissional: o usuário informa o registro e o sistema controla seu status.

## Componentes e responsabilidades

- Um layout exclusivo de gerenciamento organiza largura, navegação local e conteúdo, sem reestilizar as outras áreas.
- Componentes pequenos de cabeçalho, ficha, status, estado vazio e lista tornam a apresentação consistente dentro do escopo.
- As telas mantêm o carregamento de seus próprios dados; detalhes e versões não precisam ser carregados para desenhar apenas uma listagem ou um resumo.
- A navegação reflete a rota, sem depender apenas de estado local para selecionar uma subpágina.
- Reutilizar `ProfessionalPrescription`, `ProfessionalSessionDetail`, helpers de datas/status e componentes de formulário. Preservar recursos do editor e comparação de versões.
- Todas as novas mensagens passam pelo fluxo de tradução existente. Evitar termos técnicos nas ações do produto, como capability ou RPC.

## Estados, formulários e acessibilidade

Toda consulta tem carregamento local, erro legível com nova tentativa e estado vazio com ação pertinente. Mudanças de conta ou de pessoa selecionada não podem exibir respostas atrasadas do contexto anterior.

Formulários têm labels associados, validação dos campos obrigatórios e limites existentes. Ações de salvar, aceitar, publicar e encerrar ficam indisponíveis durante a solicitação e mostram seu resultado. O usuário consegue cancelar a edição; sair não salva dados implicitamente.

Encerrar vínculo, revogar convite e arquivar programa mantêm confirmação explícita. Os efeitos de cada ação ficam próximos ao controle correspondente.

Navegação usa links reais e `aria-current`; seleção de conteúdo em tabs, quando usada, mantém semântica e foco adequados. Foco visível, contraste, leitura com textos longos e redução de movimento devem funcionar nos temas claro e escuro.

## Critérios de aceitação e verificação

1. Todas as telas de gerenciamento seguem o mesmo layout e navegação; as demais telas mantêm seu desenho.
2. Perfil e edição, listagem e criação, profissionais e convites, materiais e histórico têm destinos separados e recuperáveis pela URL.
3. Cada profissional vinculado é identificado por dados reais retornados por uma consulta autorizada; não inventar nomes, especialidades ou status.
4. A escolha de um profissional só mostra seus dados e materiais relacionados ao aluno autenticado.
5. Convites, programas, comparação de versões, envio para aluno, início de treino, sincronização e encerramentos continuam funcionando.
6. Verificar carregamento, erros, vazio, ações concorrentes e confirmação das ações de encerramento com testes pertinentes.
7. Testar as novas consultas com usuário anônimo, aluno vinculado, aluno sem vínculo e outros profissionais/alunos. Preparar a migração e reportar separadamente se sua aplicação no ambiente real não estiver disponível.
8. Executar testes do frontend pertinentes, build, verificações de tradução, boundaries Supabase e checks da migração, conforme afetados.
9. Inspecionar visualmente as telas em 360/390 px e 1280/1440 px, com os dois temas. Validar títulos longos, listas vazias e formulários sem rolagem horizontal acidental.

## Execução pretendida

O usuário solicitou frontend-design e agentes do Superpowers. Após revisão desta especificação e do plano, dividir a implementação por áreas independentes: perfil/layout, gestão profissional e área do aluno/dados. Coordenar previamente os arquivos compartilhados para evitar alterações concorrentes. Fazer revisão integrada e verificar os fluxos existentes antes de entregar.
