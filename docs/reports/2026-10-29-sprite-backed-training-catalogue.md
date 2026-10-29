# Catálogo com sprites e revisão dos modelos de treino

## Regra de disponibilidade

Profissionais e usuários compartilham os mesmos 156 exercícios padrão com sprites locais validados. Os outros 1.168 registros continuam disponíveis para leitura do histórico, mas não para novas prescrições. O seletor profissional não oferece criação nem seleção de exercícios personalizados sem animação.

A publicação valida a disponibilidade no editor, no repositório e no banco. Gatilhos também impedem novas entregas e a ativação de prescrições profissionais antigas com exercícios pendentes. Iniciar ou repetir um treino antigo com exercícios pendentes mostra uma orientação para substituir esses movimentos; o histórico não é apagado.

## Modelos revisados

Os modelos são opções de sessões, não uma recomendação de executar sete dias consecutivos. O profissional escolhe a distribuição semanal, ajusta a carga e adapta a prescrição ao aluno. As cópias sugeridas no editor profissional começam com carga zero para que a carga do próprio profissional não seja atribuída ao aluno.

| Sessão | Movimentos em ordem | Séries totais |
| --- | --- | --- |
| Peito | Supino com barra; supino inclinado com halteres; crucifixo no cabo; flexão inclinada | 11 |
| Costas | Barra fixa assistida; remada curvada; remada sentada no cabo; puxada com braços estendidos; extensão lombar | 13 |
| Pernas | Agachamento; terra romeno; leg press; extensora; flexora deitada; panturrilha em pé na máquina | 16 |
| Abdômen | Crunch; crunch reverso; dead bug; Pallof press com faixa; roda abdominal | 10 |
| Braços | Rosca EZ; tríceps na polia; rosca inclinada; extensão de tríceps acima da cabeça no cabo; rosca martelo; tríceps testa | 14 |
| Ombros | Desenvolvimento sentado com halteres; elevação lateral; crucifixo inverso; encolhimento com halteres | 12 |
| Glúteos | Ponte com barra; terra romeno; agachamento dividido com halteres; extensão de quadril no cabo; abdução sentada na máquina | 13 |

Compostos aparecem antes dos acessórios; descansos variam de 60 a 150 segundos, com repetições adequadas ao papel de cada movimento. O treino de abdômen não usa mais mountain climber como se fosse um exercício isolado de abdômen. O treino de ombros não empilha três desenvolvimentos.

Essas escolhas são decisões de conteúdo do produto, informadas pelos princípios de especificidade, progressão e cobertura muscular do [posicionamento ACSM de 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/). A fonte não prescreve especificamente essas sete listas.

## Dados existentes

Somente modelos básicos reconhecidos por uma lista antiga exata e pelos parâmetros originais são atualizados automaticamente. IDs das rotinas, agenda e cargas de movimentos mantidos são preservados. Rotinas atribuídas, planos personalizados gerados e prescrições editadas são preservados. Modelos particulares de profissionais contendo exercícios pendentes precisam ser corrigidos antes de nova publicação; não são substituídos automaticamente por outros movimentos.

## Importação de novos sprites e publicação

O importador de sprites gera automaticamente uma nova migração com o catálogo atualizado. Alternativa manual: `npm run sync:exercise-catalogue`. `npm run check:exercise-catalogue` e os builds de produção verificam se o último snapshot SQL corresponde ao manifesto do aplicativo.

Publicar as migrações `202610290001_exercise_sprite_requirement.sql` e `20261029124038_exercise_sprite_catalogue.sql` junto com esta versão. Em futuras importações, publicar a nova migração gerada junto com o aplicativo. A tabela não aceita alteração por clientes autenticados. Nenhuma migração foi aplicada em produção nesta tarefa.

## Verificação

- Testes de catálogo, prescrições, seleção profissional, modelos, atualização de legados e início/repetição de treinos.
- Integração em PostgreSQL/WASM descartável: publicação, duplicação, entrega, envio de rascunho, ativação de legado e permissões do catálogo.
- Build de produção e igualdade das chaves de tradução nos 11 idiomas.
- A checagem estrita de textos aponta 20 strings sem tradução preexistentes em outras telas; a nova mensagem está presente em todos os idiomas.
