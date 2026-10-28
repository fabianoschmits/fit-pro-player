# Plano de implementação: atualização automática de planos profissionais

1. Criar testes unitários para o diff semântico de dias, treinos e exercícios; executá-los em vermelho.
2. Implementar o utilitário de diff e integrar seus dados à apresentação de atualizações da biblioteca.
3. Criar migração que registra eventos/visualizações, aplica a versão profissional automaticamente de forma atômica e expõe a atualização acumulada pela API já usada pela biblioteca.
4. Atualizar o fluxo profissional, a biblioteca e a tela `/plan` para os novos textos, badges e sheet de comparação.
5. Cobrir o contrato do repositório e o componente, executar os testes focalizados, os testes de banco e a suíte/build aplicáveis.
