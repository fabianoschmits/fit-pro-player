# Biblioteca de planos e workspace compartilhado

Objetivo: implementar o fluxo solicitado em 27/10/2026, preservando o editor normal, catálogo, mídia e histórico.

Decisões: entregas são referências imutáveis a versões, nunca seleção automática. A seleção é persistida no servidor e materializada nas tabelas existentes de rotinas/semana usadas pelo player. Planos pessoais são snapshots independentes; o plano pessoal selecionado acompanha as edições do editor existente. Rascunhos profissionais são privados, persistidos por aluno com revisão otimista. Envio é uma única transação. Modelos originam cópias independentes.

Etapas:
- [x] Biblioteca, seleção, rascunho, envio e permissões no PostgreSQL.
- [x] Adaptadores e repositório; remover aplicação automática nas duas superfícies atuais.
- [x] Extrair workspace e editor de rotina compartilhados, cards expansíveis com Media existente.
- [x] Rotas profissionais por aluno, modelos e biblioteca do atleta.
- [x] Consultas paginadas e telas resumidas em cards.
- [x] Testes relacionados, suíte completa, checks SQL e build; reportar limites de validação.

Riscos verificados: índice atual permite apenas uma entrega ativa por aluno; envio antigo revoga anterior; App e Meus profissionais aplicam última entrega; sync de domínio ignora seleção; IDs de rotinas recebidas atuais não são UUID; alterações de seleção durante treino não podem alterar snapshot iniciado. Todos precisam de tratamento conjunto.
