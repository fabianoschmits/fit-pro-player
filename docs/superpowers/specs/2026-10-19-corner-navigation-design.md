# Navegação de canto do Fit Pro Player

**Data:** 19 de outubro de 2026  
**Status:** aprovado para especificação; aguardando revisão do documento e plano de implementação.

## Objetivo

Substituir a página `Mais` pela navegação de canto inspirada no padrão **Menu de Canto Fit Pro Player**, preservando todos os destinos existentes, os ícones desenhados pelo próprio produto e a lógica atual de iniciar ou retomar treino.

O menu deve tornar as áreas principais imediatamente acessíveis e concentrar os destinos secundários em uma extensão vertical, sem apresentar rotas, permissões ou ações duplicadas.

## Estrutura de navegação

### Haste horizontal

Fica fixa no canto inferior da interface e contém, nesta ordem:

1. Início (`/home`)
2. Plano (`/plan`)
3. Treinar (inicia ou retoma o treino atual usando o mesmo fluxo existente)
4. Evolução (`/stats`)

O item ativo recebe o mesmo indicador visual existente. O usuário também pode deslizar horizontalmente sobre a haste para selecionar uma dessas áreas; um toque comum mantém o comportamento de clique atual.

### Pivô do canto

O pivô é o controle permanente da navegação.

- Aberto: fecha as hastes horizontal e vertical.
- Fechado: mostra o ícone e o rótulo da área atual; ao tocar, reabre a haste horizontal.
- Seu controle superior abre e fecha a haste vertical.
- Abrir uma área secundária não fecha a haste horizontal; navegar por uma opção fecha somente a haste vertical.
- Um toque fora do conjunto fecha a haste vertical. A tecla Escape também a fecha e devolve o foco ao controle que a abriu.

### Haste vertical

Substitui integralmente a página `Mais` e exibe, em grupos, as opções que ela oferecia:

| Grupo | Destinos |
| --- | --- |
| Geral | Dados pessoais, Configurações, Central da plataforma quando autorizada |
| Treino | Exercícios, Histórico, Evolução corporal |
| Profissional | Meus profissionais, Área profissional, Perfil profissional ou Tornar-se profissional, conforme a conta |
| Sobre | Ajuda e suporte, Sobre o Fit Pro Player, Termos e privacidade, Sair da conta quando autenticado |

Os títulos, subtítulos e ícones permanecem os já definidos no produto. As verificações de papel profissional e administrativo permanecem iguais às da página `More` atual. Sair da conta mantém sua confirmação antes de encerrar a sessão.

## Rotas e compatibilidade

`/more` não renderiza mais uma página. A rota será redirecionada para `/home`, preservando compatibilidade com favoritos, links internos e retornos que ainda apontem para ela.

Rotas de destino permanecem inalteradas. A área profissional, a central administrativa, convites e telas de conexão continuam sem a navegação de canto, seguindo a regra atual do aplicativo.

## Responsividade e acessibilidade

- O menu se prende ao canto inferior dentro da área segura do dispositivo.
- Em telas estreitas, a haste horizontal mantém alvos de toque adequados; a vertical respeita a altura disponível e rola internamente quando necessário.
- Os controles usam elementos `button` e `nav`, nomes acessíveis localizados, foco visível, `aria-current` para o destino ativo e estado expandido para o menu vertical.
- Ao abrir a haste vertical, o foco vai para sua primeira opção; ao fechá-la, retorna ao botão de abertura.
- `prefers-reduced-motion` remove transições de entrada, saída, indicador ativo e seleção por arrasto sem remover a funcionalidade.

## Implementação proposta

O componente atual `TabBar` será evoluído para o menu de canto, sem adotar bibliotecas ou ícones externos.

- Extrair a definição de itens secundários e das condições de visibilidade da página `More` para um módulo de dados de navegação reutilizável.
- Usar o `Icon` local em todos os itens, mantendo unidade visual com o restante do aplicativo.
- Reutilizar `useFppActivation`, o fluxo `onStart`, a detecção de treino ativo e o comportamento de arrasto já presentes em `TabBar`.
- Transferir a consulta de papéis profissional e administrativo para o menu, evitando exibir destinos indisponíveis.
- Remover o conteúdo de `More.jsx` e substituir sua rota por redirecionamento explícito.
- Substituir as regras de estilo da barra inferior por regras isoladas do menu de canto, sem afetar as navegações profissional, administrativa e internas.

## Estados e falhas

- Enquanto as permissões são carregadas, os itens dependentes de função não são mostrados; erros de consulta são tratados como ausência de permissão, como ocorre hoje.
- Se não há plano elegível, Treinar direciona para a montagem de plano, como hoje.
- Se existe treino ativo, Treinar abre esse treino em vez de iniciar outro.
- Falha ao encerrar sessão mantém a sessão atual e usa a mesma mensagem de erro existente.

## Verificação

Serão cobertos por testes os seguintes comportamentos:

1. Destinos horizontais, seleção por toque e por arrasto.
2. Início ou retomada de treino.
3. Abertura, fechamento externo, Escape e gerenciamento de foco da haste vertical.
4. Presença condicional dos destinos profissional e administrativo.
5. Confirmação de saída da conta.
6. Redirecionamento de `/more` para `/home`.
7. Layout em largura móvel, redução de movimento e compilação de produção.

## Fora do escopo

- Não alterar as rotas dos recursos existentes.
- Não tornar a navegação disponível nas áreas que hoje usam layout profissional, administrativo, convite ou conexão.
- Não alterar dados da conta, permissões ou regras de autenticação.
