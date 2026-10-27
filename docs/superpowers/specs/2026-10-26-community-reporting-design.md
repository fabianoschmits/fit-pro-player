# Denúncias da comunidade integradas ao suporte

## Objetivo

Permitir que uma pessoa denuncie uma publicação, comentário ou resposta da Comunidade pelo menu de três pontos do próprio conteúdo. A denúncia deve usar o centro de suporte e o console administrativo existentes, mas conservar o alvo e o motivo como dados estruturados para revisão confiável.

## Resultado para quem usa a Comunidade

- Menus de três pontos de conteúdo de outras pessoas oferecem **Denunciar**. Conteúdo próprio continua oferecendo apenas as ações de edição e exclusão; ele não pode ser denunciado pelo autor.
- A ação abre um diálogo acessível, com foco contido e restaurado ao fechar. A pessoa escolhe um motivo: spam, assédio ou discurso de ódio, conteúdo impróprio, informação enganosa ou outro. O motivo `outro` exige uma descrição curta.
- O envio confirma que a denúncia foi recebida, preserva a seleção e o texto quando há falha e impede duplo envio. A pessoa pode acompanhar o chamado em `Meus chamados`.
- A pessoa denunciada não recebe o nome de quem denunciou nem uma notificação de denúncia nesta entrega.

## Dados e segurança

Uma migration acrescentará a categoria de suporte `community_report` e uma tabela de contexto de denúncia ligada a `support_tickets` em relação um-para-um. O contexto registra:

- tipo do alvo (`post` ou `comment`);
- ID da publicação, ID do comentário quando aplicável e ID do autor denunciado;
- motivo padronizado;
- link interno canônico `/community?post=<postId>` para verificação;
- um trecho imutável e limitado do conteúdo no instante da denúncia, para orientar a revisão se o conteúdo for removido.

Uma RPC `community_report_content` será a única via de criação. Ela exige sessão, verifica a existência e a autoria do alvo no banco, recusa auto-denúncia, valida motivo e descrição, cria o chamado e o contexto na mesma transação e retorna o ID do chamado. A RPC deduplica uma denúncia aberta do mesmo autor para o mesmo alvo; nesse caso retorna o chamado existente sem criar outra linha. A categoria não será exposta como opção genérica no formulário de suporte.

Somente o denunciante pode ler o próprio chamado pelas RPCs existentes. Apenas administradores podem ver o contexto completo no console. Nenhuma política de leitura direta será aberta para as tabelas novas.

## Console de revisão

Chamados de denúncia aparecem na caixa de suporte com categoria **Denúncia de comunidade**. Ao abrir um chamado, o console mostra um cartão `Conteúdo denunciado` com motivo, tipo, autor, trecho e link. O botão **Abrir publicação** abre a rota canônica em nova aba; ele serve para verificação e não executa decisão de moderação automaticamente.

Os status e as prioridades existentes continuam sendo usados. A equipe pode responder, atribuir, resolver e arquivar pelo fluxo já disponível. Esta entrega não adiciona remoção de conteúdo, suspensão, bloqueio ou automação de punição; essas decisões permanecem administrativas e exigem um fluxo próprio posterior.

## Interface e acessibilidade

- Publicações: `Denunciar` é exibido no menu `•••` somente quando a autoria não é a pessoa atual.
- Comentários e respostas: o mesmo item aparece no menu `•••` de cada item de outra pessoa.
- O diálogo usa o utilitário compartilhado de foco, fecha com Escape e possui labels, estado de envio e mensagens de erro anunciáveis.
- Os controles mantêm alvos mínimos de toque, tokens de tema e comportamento responsivo existentes.

## Rotas e links

O contexto persistido armazena `/community?post=<postId>`. A rota da Comunidade já interpreta esse parâmetro para carregar e destacar a publicação. Comentários e respostas apontam para a publicação pai, evitando links frágeis para uma posição específica dentro de uma thread.

## Testes e validação

- Testes SQL da RPC: autenticação, existência do alvo, auto-denúncia, validação dos motivos, deduplicação, link e acesso administrativo.
- Testes de repositório: mapeamento e chamada da RPC.
- Testes React: presença correta do item em menus de post/comentário, abertura/fechamento/foco do diálogo, envio, erro preservando rascunho e ausência da ação em conteúdo próprio.
- Testes do console: exibição do cartão de contexto e link canônico.
- E2E: denúncia de publicação e comentário em desktop e mobile com o link correto no payload simulado.

## Fora de escopo

- Ações automáticas contra o conteúdo ou a conta denunciada.
- Exibir o número de denúncias em publicações, comentários ou perfis.
- Denúncias para mensagens privadas, perfis, fotos de perfil ou treinos.
- Ferramentas de bloqueio/silenciamento, fila dedicada de moderação, SLA ou notificações push específicas.
