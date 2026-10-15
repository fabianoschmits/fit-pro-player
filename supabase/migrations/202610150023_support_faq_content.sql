create unique index if not exists support_faq_question_unique on public.support_faq_articles (question);

with faq(category_slug, question, answer, sort_order, is_featured) as (values
  ('question', 'Como criar e organizar um plano de treino?', $$Acesse Plano para criar ou editar suas rotinas e distribuir os dias de treino da semana. Você pode organizar exercícios, séries, repetições, cargas e observações conforme sua necessidade.$$ , 10, true),
  ('question', 'Como começo um treino?', $$Abra o Plano, escolha a rotina do dia e toque em iniciar. Durante a sessão, o aplicativo mostra os exercícios, séries, cargas, repetições e o tempo de descanso.$$ , 20, true),
  ('training', 'Como registrar séries, repetições e cargas?', $$Durante o treino, preencha os campos de cada série e marque a série como concluída. O registro fica associado à sessão e pode ser consultado depois no Histórico.$$ , 30, false),
  ('training', 'Posso editar um exercício ou criar um exercício personalizado?', $$Sim. Na área de exercícios você pode consultar o catálogo e, quando necessário, criar um exercício personalizado com as informações que serão usadas no seu plano.$$ , 40, false),
  ('training', 'Como funciona o descanso entre as séries?', $$O descanso pode ser acompanhado pelo temporizador exibido durante a execução. Ajuste o tempo de acordo com o seu treino e respeite seus limites físicos.$$ , 50, false),
  ('training', 'O aplicativo substitui a orientação de um profissional?', $$Não. O Fit Pro Player organiza e registra seus treinos, mas não substitui avaliação, prescrição ou acompanhamento de um profissional de educação física ou de saúde.$$ , 60, true),
  ('question', 'Como consultar as instruções de um exercício?', $$Abra Exercícios ou toque no exercício dentro de um treino. Você poderá consultar a demonstração, os músculos envolvidos e as instruções disponíveis para aquele movimento.$$ , 70, false),
  ('question', 'O que encontro no Histórico?', $$O Histórico reúne as sessões concluídas e permite rever os treinos realizados ao longo do tempo, incluindo os registros feitos durante cada sessão.$$ , 80, true),
  ('question', 'Como acompanhar peso e evolução corporal?', $$Use Evolução corporal para registrar medidas e peso em check-ins e acompanhar as mudanças ao longo do tempo. Procure registrar as medidas em condições parecidas para facilitar a comparação.$$ , 90, true),
  ('question', 'Como funcionam as Estatísticas?', $$Estatísticas organizam informações de consistência, volume, desempenho e evolução para ajudar você a entender seu histórico. Elas são baseadas nos registros que você realizou no aplicativo.$$ , 100, false),
  ('question', 'O que é o BodyMap?', $$O BodyMap mostra visualmente as regiões e músculos trabalhados a partir dos exercícios registrados. Use-o como uma visão geral do treino, não como diagnóstico médico.$$ , 110, false),
  ('account', 'Preciso criar uma conta para usar o aplicativo?', $$O aplicativo pode oferecer uma experiência local no dispositivo, mas uma conta é necessária para os recursos vinculados ao Supabase, como sincronização, relacionamentos profissionais e continuidade dos dados entre sessões.$$ , 120, true),
  ('account', 'Como faço login ou recupero o acesso à minha conta?', $$Acesse as opções de conta na tela de entrada e siga o fluxo de autenticação. Se não conseguir acessar, use a recuperação disponível ou fale com a equipe pelo suporte.$$ , 130, false),
  ('account', 'Meus dados são sincronizados?', $$Quando você usa uma conta conectada, os recursos compatíveis são sincronizados com segurança. Algumas informações locais podem permanecer no dispositivo e dependem do estado da conexão para serem enviadas.$$ , 140, true),
  ('account', 'O que acontece quando troco de conta no mesmo dispositivo?', $$Cada conta possui seu próprio espaço de dados. Antes de trocar de conta, aguarde as alterações pendentes serem sincronizadas e confirme que está usando a conta correta para evitar registrar um treino no perfil errado.$$ , 150, false),
  ('account', 'Como excluir minha conta e meus dados?', $$Abra Configurações e procure as opções de conta e dados pessoais. A exclusão é uma ação permanente; revise as informações e confirme somente se tiver certeza de que deseja remover os dados da conta.$$ , 160, false),
  ('question', 'Como conectar um profissional?', $$Use a área de profissionais para adicionar ou aceitar um vínculo por convite. Depois que o vínculo estiver ativo, você poderá consultar os programas e materiais disponibilizados por esse profissional.$$ , 170, true),
  ('question', 'O que um profissional pode ver?', $$O acesso depende do vínculo e dos recursos compartilhados pelo aplicativo. O profissional acompanha o que é necessário para organizar programas e materiais, enquanto seus dados pessoais e controles de conta permanecem protegidos.$$ , 180, false),
  ('question', 'Como um profissional organiza alunos e programas?', $$Na Área profissional, o profissional pode acompanhar alunos vinculados, criar programas, organizar versões e enviar materiais de acordo com os recursos disponíveis na conta.$$ , 190, false),
  ('question', 'Recebi um convite profissional. O que faço?', $$Abra o convite, confira o perfil apresentado e aceite somente se reconhecer o profissional. Se o convite estiver incorreto ou expirado, fale com a equipe para receber orientação.$$ , 200, false),
  ('question', 'Como funcionam as notificações e lembretes?', $$As notificações ajudam a lembrar da rotina de treino e de eventos do aplicativo. Você pode revisar as preferências em Configurações; a disponibilidade também depende das permissões do dispositivo e do navegador.$$ , 210, false),
  ('privacy', 'Como meus dados são protegidos?', $$O acesso aos dados da conta é controlado pela autenticação e pelas permissões do aplicativo. Consulte Privacidade e configurações de privacidade para conhecer seus direitos e os controles disponíveis.$$ , 220, true),
  ('privacy', 'Como exportar ou consultar meus dados?', $$Acesse Dados pessoais e as opções de privacidade disponíveis na sua conta. Se precisar de uma solicitação específica relacionada aos seus dados, envie uma mensagem para a equipe.$$ , 230, false),
  ('technical', 'O treino não carregou ou ficou desatualizado. O que faço?', $$Confira sua conexão, aguarde alguns instantes e abra novamente a tela. Se o problema continuar, registre o horário, a tela afetada e o que aconteceu e envie essas informações para a equipe.$$ , 240, true),
  ('technical', 'Posso usar o aplicativo sem conexão?', $$Alguns recursos e materiais já disponíveis no dispositivo podem continuar acessíveis localmente. Para sincronizar dados, atualizar conteúdos ou carregar recursos que ainda não foram baixados, será necessário conectar-se novamente.$$ , 250, false),
  ('other', 'Como enviar uma dúvida, crítica ou sugestão?', $$Acesse Ajuda e suporte, toque em Fale com a equipe, escolha a categoria, informe um assunto e descreva a situação. Você poderá acompanhar a conversa em Meus chamados.$$ , 260, true),
  ('other', 'Quanto tempo leva para receber uma resposta?', $$A equipe responderá pelo próprio aplicativo. O prazo pode variar conforme o volume e a complexidade das mensagens; mantenha as informações do chamado completas para facilitar o atendimento.$$ , 270, false),
  ('other', 'Como acompanhar ou reabrir um chamado?', $$Abra Meus chamados para consultar o status e as respostas. Um chamado resolvido pode receber uma nova mensagem para continuar o atendimento; chamados arquivados ficam apenas para consulta.$$ , 280, false)
)
insert into public.support_faq_articles (category_id, question, answer, sort_order, is_featured, is_published)
select c.id, faq.question, faq.answer, faq.sort_order, faq.is_featured, true
from faq join public.support_categories c on c.slug = faq.category_slug
on conflict (question) do update set
  category_id = excluded.category_id,
  answer = excluded.answer,
  sort_order = excluded.sort_order,
  is_featured = excluded.is_featured,
  is_published = true,
  updated_at = now(),
  published_at = coalesce(public.support_faq_articles.published_at, now());
