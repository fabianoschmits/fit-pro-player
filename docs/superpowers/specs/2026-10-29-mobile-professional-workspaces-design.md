# Revisão mobile de Meus profissionais e Área profissional

## Objetivo

Organizar a experiência de celular nas áreas “Meus profissionais” (aluno) e “Área profissional” sem alterar regras de negócio, destinos de navegação ou conteúdo funcional. A revisão cobre páginas principais, subpáginas, estados vazios, formulários, planos e sobreposições relacionadas a esses fluxos.

## Contexto observado

- As duas áreas compartilham `ManagementLayout`, mas possuem navegação e conteúdo próprios.
- A navegação profissional inclui cinco destinos; os detalhes de aluno também apresentam cinco seções em trilho horizontal.
- A grade de ações rápidas do painel profissional mantém quatro colunas em celular, comprimindo rótulos em larguras estreitas.
- A regra para larguras até 360 px força a ação do cabeçalho a ocupar uma linha inteira.
- Formulários de plano/modelo e seletores de exercícios são densos e usam diferentes padrões de espaçamento e rolagem.
- Os diálogos compartilham uma base responsiva, enquanto confirmações são abertas como folhas globais.

## Abordagens consideradas

1. **Correções pontuais:** baixo risco e custo, mas mantém inconsistências entre rotas relacionadas.
2. **Revisão coesa mobile (escolhida):** melhora a camada responsiva compartilhada e aplica exceções locais onde necessário, mantendo os fluxos atuais.
3. **Reorganização profunda:** redesenha hierarquias e conteúdo das páginas; maior impacto e fora da preferência expressa.

## Desenho escolhido

### Estrutura compartilhada

Padronizar margens laterais, largura útil, espaçamento vertical, cartões e ações nos breakpoints móveis. Corrigir a composição do cabeçalho para que título, retorno e ação não se comprimam nem criem uma quebra visual abrupta em telas estreitas.

### Navegação

Preservar destinos e nomes existentes. Tornar os trilhos horizontais de navegação confortáveis ao toque e mais compreensíveis quando houver itens fora da área visível; revisar o posicionamento inicial/ativo para que a seção atual não fique escondida. Ajustar os cinco itens de seção do aluno e as navegações principal do aluno/profissional sem criar novas rotas.

### Conteúdo das páginas

Em telas pequenas, reequilibrar ações rápidas, listas, filtros, cabeçalhos de cartões, formulários e fatos do perfil. Priorizar empilhamento e quebra de texto previsíveis, controles de largura total quando necessário e alvos de toque confortáveis. Em plano/modelo, manter a hierarquia de treino e tornar os controles densos navegáveis sem rolagem horizontal acidental.

### Modais e folhas

Revisar diálogos e folhas usados por estes fluxos para respeitar a área visível do celular, considerar safe areas, limitar alturas com rolagem interna e manter cabeçalho/ações utilizáveis quando o conteúdo for longo. Não alterar as ações confirmadas nem sua semântica.

## Escopo

Inclui `/student/professionals` e suas rotas de adicionar, convite, materiais e detalhe do profissional; `/professional` e suas rotas de convites, alunos, perfil do aluno, plano, modelos e perfil profissional; componentes compartilhados acionados por esses fluxos. Inclui modais, folhas de confirmação e seletores relacionados.

Exclui outras áreas do app, redesenho desktop, mudança de conteúdo/traduções, regras de negócio, APIs, dados, permissões e funcionalidades novas.

## Critérios de aceitação

- Em larguras de 320, 360, 390 e 430 px, páginas e sobreposições cobertas não apresentam overflow horizontal involuntário, conteúdo cortado ou ações inacessíveis.
- Cabeçalhos e navegações mantêm hierarquia legível e alvos de toque utilizáveis, inclusive quando há rótulos longos.
- Listas, filtros, formulários, planos e perfis têm espaçamento consistente e podem ser percorridos verticalmente sem perda de contexto.
- Modais e folhas cabem na viewport móvel, respeitam safe areas e permitem rolar conteúdo extenso até suas ações.
- Fluxos, rotas e comportamento funcional permanecem iguais.

## Validação prevista

Inspecionar as rotas cobertas nos breakpoints aceitos e revisar conteúdo longo, listas vazias, menus/abas e modais. Executar verificações de compilação e os checks já aplicáveis após a implementação; não adicionar infraestrutura de teste sem necessidade demonstrada.
